import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { AppError } from "./lib/errors.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerShopRoutes } from "./routes/shop.js";

export async function buildApp() {
  const app = Fastify({ logger: true, trustProxy: true });

  await app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  // حماية CSRF: الطلبات المغيِّرة يجب أن تأتي من نفس الأصل
  app.addHook("onRequest", async (req) => {
    if (req.method === "GET" || req.method === "HEAD" || !req.url.startsWith("/api")) return;
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) {
      throw new AppError("BAD_ORIGIN", "Cross-origin request blocked", 403);
    }
  });

  app.setErrorHandler((err: any, _req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send({ error: err.code, message: err.message });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: "BAD_REQUEST", message: err.message });
    app.log.error(err);
    return reply.status(500).send({ error: "INTERNAL", message: "Internal error" });
  });

  await registerAuthRoutes(app);
  await registerShopRoutes(app);

  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL("../public", import.meta.url)),
  });
  return app;
}
