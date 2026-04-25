import { ImageResponse } from "next/og";

import { siteConfig } from "@/lib/seo";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #f6efe4 0%, #fff9f0 40%, #d9efe8 100%)",
          color: "#0f172a",
          padding: "56px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            borderRadius: "40px",
            background: "rgba(255,255,255,0.84)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            boxShadow: "0 24px 64px rgba(15, 23, 42, 0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: "72%",
              padding: "56px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "0.24em",
                  textTransform: "uppercase",
                  color: "#115e59",
                }}
              >
                Alexandria corridor
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 68,
                  lineHeight: 1.05,
                  fontWeight: 900,
                  maxWidth: "760px",
                }}
              >
                Mobility intelligence for a real Alexandria route.
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 28,
                  lineHeight: 1.4,
                  maxWidth: "760px",
                  color: "#334155",
                }}
              >
                Live traffic, 15-minute predictions, history, and scenario analysis
                for Victoria, Sidi Gaber, and Raml.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "18px",
                alignItems: "center",
                color: "#475569",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              <span>Victoria</span>
              <span>-&gt;</span>
              <span>Sidi Gaber</span>
              <span>-&gt;</span>
              <span>Raml</span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: "28%",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, #0f766e 0%, #134e4a 100%)",
              padding: "36px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  width: "220px",
                  height: "220px",
                  borderRadius: "40px",
                  background: "#fffaf0",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 20px 50px rgba(15, 23, 42, 0.28)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "172px",
                    height: "128px",
                    borderRadius: "18px",
                    overflow: "hidden",
                    position: "relative",
                    background: "#65c8ea",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: "0 0 0 0",
                      background:
                        "linear-gradient(180deg, #65c8ea 0 62%, #f0c241 62% 100%)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "74px",
                      top: "24px",
                      width: "24px",
                      height: "66px",
                      borderRadius: "8px",
                      background: "#fff7ea",
                      border: "4px solid #0f172a",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "68px",
                      top: "12px",
                      width: "36px",
                      height: "18px",
                      background: "#fff7ea",
                      border: "4px solid #0f172a",
                      borderBottom: "0",
                      clipPath: "polygon(12% 100%, 88% 100%, 74% 0, 26% 0)",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "66px",
                      top: "88px",
                      width: "40px",
                      height: "14px",
                      background: "#0f172a",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "96px",
                      top: "30px",
                      width: "44px",
                      height: "18px",
                      background: "#f8d86a",
                      clipPath: "polygon(0 50%, 100% 0, 100% 100%)",
                      opacity: 0.95,
                    }}
                  />
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  textAlign: "center",
                  color: "white",
                  fontSize: 22,
                  fontWeight: 800,
                  lineHeight: 1.35,
                  maxWidth: "250px",
                }}
              >
                Alexandria Governorate flag inspired favicon and social preview
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
