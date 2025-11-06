import React from "react";
import MarkdownText from "./MarkdownText";

const DEFAULT_TEXT =
  "To take part in this study you must confirm that you are at least 16 years old. If you are younger than 16, please close this window or select “I am under 16” below.";

const AgeConfirmationModal = ({ text, onConfirm, onDecline }) => {
  const handleDecline = () => {
    if (typeof onDecline === "function") {
      onDecline();
    }
  };

  const content = typeof text === "string" && text.trim() !== "" ? text : DEFAULT_TEXT;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          width: "90%",
          maxWidth: "480px",
          borderRadius: "10px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          textAlign: "left",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ margin: 0 }}>Age Confirmation</h2>
        <div style={{ margin: 0, fontSize: "0.95rem", color: "#111827" }}>
          <MarkdownText content={content} className="space-y-3 text-sm text-gray-800" />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <button
            onClick={() => {
              if (typeof onConfirm === "function") {
                onConfirm();
              }
            }}
            style={{
              padding: "10px",
              backgroundColor: "#1452EE",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            I am 16 or older
          </button>
          <button
            onClick={handleDecline}
            style={{
              padding: "10px",
              backgroundColor: "#e5e7eb",
              color: "#111827",
              border: "none",
              borderRadius: "6px",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            I am under 16
          </button>
        </div>
      </div>
    </div>
  );
};

export default AgeConfirmationModal;
