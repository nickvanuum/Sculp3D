// src/global.d.ts
export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": {
        src?: string;
        alt?: string;
        poster?: string;

        // boolean attributes (presence = true)
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        ar?: boolean;

        // numeric/string attributes
        exposure?: string | number;
        "shadow-intensity"?: string | number;

        // standard stuff you might use
        style?: React.CSSProperties;
        className?: string;
        children?: React.ReactNode;
      };
    }
  }
}
