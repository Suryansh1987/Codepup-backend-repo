import express from "express";
import { StatelessSessionManager } from "./session";
import { DrizzleMessageHistoryDB } from "../db/messagesummary";
import { RedisService } from "../services/Redis";
import Anthropic from "@anthropic-ai/sdk";
export declare function initializeModificationRoutes(anthropic: Anthropic, messageDB: DrizzleMessageHistoryDB, redis: RedisService, sessionManager: StatelessSessionManager): express.Router;
