import React, { useEffect, useRef, useState } from "react";
import MarkdownText from "./MarkdownText";

const ConsentModal = ({
  consentText,
  checkboxChecked,
  setCheckboxChecked,
  onSubmit,
}) => {
  const textRef = useRef(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      const { scrollHeight, clientHeight } = textRef.current;
      if (scrollHeight <= clientHeight) {
        setScrolledToBottom(true);
      }
    }
  }, [consentText]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollTop + clientHeight >= scrollHeight - 5) {
      setScrolledToBottom(true);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          width: "90%",
          maxWidth: "600px",
          maxHeight: "80vh",
          borderRadius: "10px",
          padding: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <h2>Consent Form</h2>
        <div
          ref={textRef}
          onScroll={handleScroll}
          style={{
            overflowY: "auto",
            flex: "1 1 auto",
            marginBottom: "12px",
            border: "1px solid #ccc",
            borderRadius: "6px",
            padding: "10px",
          }}
        >
          {consentText?.trim() ? (
            <MarkdownText content={consentText} className="space-y-3 text-sm leading-relaxed" />
          ) : (
            <p className="text-sm text-gray-600">No consent text configured.</p>
          )}
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="checkbox"
            checked={checkboxChecked}
            onChange={(e) => setCheckboxChecked(e.target.checked)}
          />
          I agree to the terms and conditions.
        </label>
        <button
          disabled={!scrolledToBottom || !checkboxChecked}
          onClick={onSubmit}
          style={{
            marginTop: "12px",
            padding: "10px",
            backgroundColor: scrolledToBottom && checkboxChecked ? "#1452EE" : "#ccc",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: scrolledToBottom && checkboxChecked ? "pointer" : "not-allowed",
          }}
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export default ConsentModal;
