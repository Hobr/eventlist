import { vi } from "vitest";

vi.stubGlobal("crypto", globalThis.crypto);
