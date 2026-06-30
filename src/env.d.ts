/// <reference path="../.astro/types.d.ts" />

import type { AdminAuthResult } from "./lib/auth/admin";

declare global {
    namespace App {
        interface Locals {
            admin?: AdminAuthResult;
        }
    }
}
