import { expect, test } from "vitest";
import { evaluateTrigger } from "./trigger";

test("evaluateTrigger - does not trigger before phase end day", () => {
  const phase = {
    name: "Germination",
    startDay: 1,
    endDay: 21,
    thresholdMm: 15,
    payoutPct: 0.3,
  };

  const readings = [
    { dayIndex: 5, rainfallMm: 2 },
    { dayIndex: 10, rainfallMm: 2 },
    { dayIndex: 15, rainfallMm: 3 },
  ];

  // Clock is at day 20, which is before endDay (21)
  const result = evaluateTrigger(phase, readings, 20);
  expect(result.breached).toBe(false);
  expect(result.cumulativeMm).toBe(0);
});

test("evaluateTrigger - triggers on drought breach at phase end day", () => {
  const phase = {
    name: "Germination",
    startDay: 1,
    endDay: 21,
    thresholdMm: 15,
    payoutPct: 0.3,
  };

  // Cumulative rain = 2 + 3 + 5 = 10mm <= 15mm threshold (breach!)
  const readings = [
    { dayIndex: 5, rainfallMm: 2 },
    { dayIndex: 10, rainfallMm: 3 },
    { dayIndex: 21, rainfallMm: 5 },
  ];

  const result = evaluateTrigger(phase, readings, 21);
  expect(result.breached).toBe(true);
  expect(result.cumulativeMm).toBe(10);
});

test("evaluateTrigger - does not trigger if rainfall exceeds threshold", () => {
  const phase = {
    name: "Germination",
    startDay: 1,
    endDay: 21,
    thresholdMm: 15,
    payoutPct: 0.3,
  };

  // Cumulative rain = 5 + 5 + 10 = 20mm > 15mm threshold (no breach)
  const readings = [
    { dayIndex: 5, rainfallMm: 5 },
    { dayIndex: 10, rainfallMm: 5 },
    { dayIndex: 21, rainfallMm: 10 },
  ];

  const result = evaluateTrigger(phase, readings, 22); // evaluated past phase end day
  expect(result.breached).toBe(false);
  expect(result.cumulativeMm).toBe(20);
});

test("evaluateTrigger - boundary condition (exactly equal to threshold) triggers", () => {
  const phase = {
    name: "Germination",
    startDay: 1,
    endDay: 21,
    thresholdMm: 15,
    payoutPct: 0.3,
  };

  // Cumulative rain = 5 + 5 + 5 = 15mm (exactly equal to threshold)
  const readings = [
    { dayIndex: 5, rainfallMm: 5 },
    { dayIndex: 10, rainfallMm: 5 },
    { dayIndex: 21, rainfallMm: 5 },
  ];

  const result = evaluateTrigger(phase, readings, 21);
  expect(result.breached).toBe(true); // Inclusive <= operator
  expect(result.cumulativeMm).toBe(15);
});
