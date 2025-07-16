import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { StatelessSessionManager } from "./session";
declare const router: import("express-serve-static-core").Router;
import { DrizzleMessageHistoryDB } from "../db/messagesummary";
export declare function initializeAgentRoutes(anthropic: Anthropic, db: DrizzleMessageHistoryDB, sessionMgr: StatelessSessionManager): Router;
export default router;
