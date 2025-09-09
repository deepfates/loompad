import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import nocache from "nocache";
import express, { Application } from "express";
import { getMainProps } from "server/main_props";
import { generateText, AVAILABLE_MODELS } from "./generation";

export function setup_routes(app: Application) {
  // Scope API middleware to /api to avoid affecting static/SSR caching
  app.use("/api", cors());
  app.use("/api", express.json());
  app.use("/api", cookieParser());
  app.use("/api", nocache());
  app.use("/api", compression());

  app.get("/api/props", async (req, res) => {
    const top_level_state = await getMainProps(req);
    res.json(top_level_state);
  });

  // Text generation endpoints
  app.post("/api/generate", generateText);

  // Get available models
  app.get("/api/models", (req, res) => {
    res.json(AVAILABLE_MODELS);
  });
}
