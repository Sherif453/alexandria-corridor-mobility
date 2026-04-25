import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "#fffaf0",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "136px",
            height: "102px",
            borderRadius: "18px",
            overflow: "hidden",
            position: "relative",
            background: "#65c8ea",
            boxShadow: "0 14px 32px rgba(15, 23, 42, 0.18)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 0 0 0",
              background: "linear-gradient(180deg, #65c8ea 0 62%, #f0c241 62% 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "58px",
              top: "18px",
              width: "18px",
              height: "52px",
              borderRadius: "6px",
              background: "#fff7ea",
              border: "4px solid #0f172a",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "53px",
              top: "8px",
              width: "28px",
              height: "16px",
              background: "#fff7ea",
              border: "4px solid #0f172a",
              borderBottom: "0",
              clipPath: "polygon(12% 100%, 88% 100%, 74% 0, 26% 0)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "50px",
              top: "70px",
              width: "34px",
              height: "12px",
              background: "#0f172a",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "76px",
              top: "24px",
              width: "34px",
              height: "14px",
              background: "#f8d86a",
              clipPath: "polygon(0 50%, 100% 0, 100% 100%)",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
