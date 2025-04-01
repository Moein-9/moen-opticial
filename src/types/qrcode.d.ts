
declare module 'qrcode' {
  export function toDataURL(text: string, options?: {
    width?: number;
    height?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  }): Promise<string>;
}
