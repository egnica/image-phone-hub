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
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #0f172a 0%, #1e293b 42%, #4338ca 100%)",
          borderRadius: 38,
        }}
      >
        <div
          style={{
            width: 112,
            height: 88,
            display: "flex",
            position: "relative",
            border: "8px solid rgba(255,255,255,0.96)",
            borderRadius: 22,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              position: "absolute",
              top: 15,
              right: 17,
              borderRadius: 999,
              background: "rgba(255,255,255,0.96)",
            }}
          />
          <div
            style={{
              width: 46,
              height: 46,
              position: "absolute",
              left: 15,
              bottom: 10,
              transform: "rotate(45deg)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.96)",
            }}
          />
          <div
            style={{
              width: 39,
              height: 39,
              position: "absolute",
              right: 11,
              bottom: 8,
              transform: "rotate(45deg)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.96)",
            }}
          />
          <div
            style={{
              width: 42,
              height: 42,
              position: "absolute",
              right: -18,
              top: -25,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "#ffffff",
              boxShadow: "0 6px 18px rgba(15,23,42,0.28)",
            }}
          >
            <div
              style={{
                width: 5,
                height: 20,
                position: "absolute",
                background: "#4338ca",
                borderRadius: 999,
              }}
            />
            <div
              style={{
                width: 14,
                height: 14,
                position: "absolute",
                top: 9,
                borderLeft: "5px solid #4338ca",
                borderTop: "5px solid #4338ca",
                transform: "rotate(45deg)",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
