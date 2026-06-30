import eslintPluginAstro from "eslint-plugin-astro";

import { defineConfig, globalIgnores } from "eslint/config";

export default [
    // add more generic rule sets here, such as:
    // js.configs.recommended,
    ...eslintPluginAstro.configs.recommended,
    globalIgnores([
        ".astro/**",
        ".tmp-build-public-site/**",
        ".wrangler/**",
        "dist/**",
    ]),
    {
        rules: {
            // override/add rules settings here, such as:
            // "astro/no-set-html-directive": "error"
        },
    },
];
