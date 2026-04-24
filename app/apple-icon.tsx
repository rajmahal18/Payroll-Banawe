import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180
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
            "linear-gradient(135deg, #f6d8bf 0%, #dceee7 56%, #dfeaf6 100%)"
        }}
      >
        <div
          style={{
            width: 124,
            height: 124,
            borderRadius: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 252, 247, 0.96)",
            boxShadow: "0 16px 32px rgba(82, 66, 51, 0.18)",
            color: "#1f5d56",
            fontSize: 58,
            fontWeight: 800
          }}
        >
          RV
        </div>
      </div>
    ),
    size
  );
}
