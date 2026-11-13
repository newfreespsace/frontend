import "streamsaver/examples/zip-stream";

interface FileLike {
  name: string;
  stream(): ReadableStream;
  lastModified?: number;
  directory?: boolean;
  comment?: string;
}

interface ZipController {
  enqueue(file: FileLike): void;
  close(): void;
}

interface ZipSource {
  start?(controller: ZipController): void | Promise<void>;
  pull?(controller: ZipController): void | Promise<void>;
}

export const createZipStream: (underlyingSource: ZipSource) => ReadableStream<Uint8Array<ArrayBuffer>> = (window as any)
  .ZIP;

export async function createZipBlob(underlyingSource: ZipSource): Promise<Blob> {
  return await new Response(createZipStream(underlyingSource)).blob();
}
