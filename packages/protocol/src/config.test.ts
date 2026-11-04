import { describe, it, expect } from "vitest";
import { STATION_NAME, HUMAN_CAPACITY, TICK_SECONDS } from "./config";
describe("config", () => {
  it("has locked product constants", () => {
    expect(STATION_NAME).toBe("Waystation Crew");
    expect(HUMAN_CAPACITY).toBe(100);
    expect(TICK_SECONDS).toBe(1);
  });
});
