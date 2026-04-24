import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512
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
            "linear-gradient(135deg, #f6d8bf 0%, #dceee7 56%, #dfeaf6 100%)"
        }}
      >
        <div
          style={{
            width: 340,
            height: 340,
            borderRadius: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 252, 247, 0.96)",
            boxShadow: "0 24px 48px rgba(82, 66, 51, 0.18)",
            color: "#1f5d56",
            fontSize: 126,
            fontWeight: 800,
            letterSpacing: -6
          }}
        >
          RV
        </div>
      </div>
    ),
    size
  );
}
