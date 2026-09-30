import { describe, expect, it } from "vitest";
import { GET } from "../src/routes/api/v1/health/+server";

describe("versioned backend health", () => {
  it("reports health", async () => {
    const response = await GET({} as Parameters<typeof GET>[0]);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", service: "sonda-backend" });
  });
});
