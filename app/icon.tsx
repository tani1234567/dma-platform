import { ImageResponse } from "next/og";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const contentType = "image/png";

export default async function Icon() {
  // Read the DMA logo PNG file
  const logoPath = path.join(process.cwd(), "public", "DMA_logo.png");
  const logoBuffer = fs.readFileSync(logoPath);
  const logoBase64 = logoBuffer.toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 64,
          background: "white",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10px",
          backgroundImage: `url(data:image/png;base64,${logoBase64})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />
    ),
    {
      width: 192,
      height: 192,
    }
  );
}
