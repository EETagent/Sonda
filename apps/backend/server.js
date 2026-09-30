// Keep production defaults aligned with the local dev server and upload parser.
process.env.PORT ??= "3001";
process.env.HOST ??= "127.0.0.1";
process.env.BODY_SIZE_LIMIT ??= String(25 * 1024 * 1024);

await import("./build/index.js");
