declare module 'officeparser' {
  export function parseOfficeAsync(filePath: string): Promise<string>;
  export function parseOffice(filePath: string, callback: (err: Error | null, data: string) => void): void;
}

