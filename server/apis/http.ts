import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import nocache from "nocache";
import express, { Application } from "express";
import { Server } from "socket.io";
import { getMainProps } from "server/main_props";
import { generateText, getModels, addModel, updateModel, deleteModel } from "./generation";

// socket.io context can be used to push messages from api routes
export function setup_routes(app: Application, io: Server) {
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(nocache());
  app.use(compression());

  app.get("/api/props", async (req, res) => {
    const top_level_state = await getMainProps(req);
    res.json(top_level_state);
  });

  // Text generation endpoints
  app.post("/api/generate", generateText);

  // Model management endpoints
  app.get("/api/models", getModels);
  app.post("/api/models", addModel);
  app.put("/api/models/:id", updateModel);
  app.delete("/api/models/:id", deleteModel);
}
