import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("detectImageType", () => {
  it("recognises PNG, JPEG and WebP", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(
      "image/png",
    );
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      "image/webp",
    );
  });

  it("rejects anything else, including SVG and HTML", () => {
    expect(detectImageType(new TextEncoder().encode("<svg xmlns="))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
    expect(
      detectImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x41, 0x56, 0x49, 0x20)),
    ).toBeNull();
  });
});
