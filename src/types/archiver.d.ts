// archiver v8 ships no type declarations; minimal surface we use
declare module "archiver" {
  import { Readable, Transform } from "stream";

  export interface ZipArchiveOptions {
    zlib?: { level?: number };
  }

  export class Archiver extends Transform {
    append(source: Readable | Buffer | string, data: { name: string }): this;
    finalize(): Promise<void>;
  }

  export class ZipArchive extends Archiver {
    constructor(options?: ZipArchiveOptions);
  }
  export class TarArchive extends Archiver {}
  export class JsonArchive extends Archiver {}
}
