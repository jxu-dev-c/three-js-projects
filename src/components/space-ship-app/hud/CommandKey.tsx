import * as React from "react";
import { Icon } from "@iconify/react";

export interface CommandKeyProps {
  icon: string;
  text: string;
  code: string;
}

export default function CommandKey({ icon, text, code }: CommandKeyProps) {
  return (
    <button type="button" className="command-key hud-brackets">
      <span className="command-key__code">{code}</span>
      <Icon icon={icon} className="command-key__icon" />
      <span className="command-key__label">{text}</span>
    </button>
  );
}
