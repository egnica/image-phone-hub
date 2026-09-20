import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 108,
        }}
      >
        <div
          style={{
            width: 318,
            height: 250,
            display: "flex",
            position: "relative",
            border: "22px solid rgba(255,255,255,0.96)",
            borderRadius: 62,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: 50,
              height: 50,
              position: "absolute",
              top: 42,
              right: 48,
              borderRadius: 999,
              background: "rgba(255,255,255,0.96)",
            }}
          />
          <div
            style={{
              width: 128,
              height: 128,
              position: "absolute",
              left: 42,
              bottom: 30,
              transform: "rotate(45deg)",
              borderRadius: 22,
              background: "rgba(255,255,255,0.96)",
            }}
          />
          <div
            style={{
              width: 108,
              height: 108,
              position: "absolute",
              right: 34,
              bottom: 24,
              transform: "rotate(45deg)",
              borderRadius: 22,
              background: "rgba(255,255,255,0.96)",
            }}
          />
          <div
            style={{
              width: 116,
              height: 116,
              position: "absolute",
              right: -50,
              top: -72,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "#ffffff",
              boxShadow: "0 16px 46px rgba(15,23,42,0.28)",
            }}
          >
            <div
              style={{
                width: 14,
                height: 56,
                position: "absolute",
                background: "#4338ca",
                borderRadius: 999,
              }}
            />
            <div
              style={{
                width: 40,
                height: 40,
                position: "absolute",
                top: 24,
                borderLeft: "14px solid #4338ca",
                borderTop: "14px solid #4338ca",
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
