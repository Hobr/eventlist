type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
    interface Locals extends Runtime {
        adminIdentity?: {
            email: string;
            source: "access" | "dev";
        };
    }
}
