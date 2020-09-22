import React from "react";

import NeoType from "./NeoType";

type Props = {
  name: string;
  type?: string | number;
  arg?: string | number;
  onUpdate: (newArgument: string | number) => void;
};

export default function ArgumentInput({ name, type, arg, onUpdate }: Props) {
  const inputStyle: React.CSSProperties = {
    color: "var(--vscode-input-foreground)",
    backgroundColor: "var(--vscode-input-background)",
    border: "1px solid var(--vscode-input-border)",
    boxSizing: "border-box",
    width: "calc(100% - 15px)",
    fontSize: "0.8rem",
    padding: 1,
    marginLeft: 15,
  };
  const coerceType = (text: string) => {
    if (`${parseInt(text)}` === text) {
      return parseInt(text);
    } else if (`${parseFloat(text)}` === text) {
      return parseFloat(text);
    } else {
      return `${text}`;
    }
  };
  return (
    <div style={{ marginLeft: 15, marginTop: 4 }}>
      <div>
        <strong>{name}</strong>{" "}
        <small>
          {" "}
          <em>
            (<NeoType type={type} />)
          </em>
        </small>
      </div>
      <input
        style={inputStyle}
        type="text"
        value={arg}
        onChange={(e) => onUpdate(coerceType(e.target.value))}
      />
    </div>
  );
}
