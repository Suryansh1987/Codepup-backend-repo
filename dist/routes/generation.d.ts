import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { DrizzleMessageHistoryDB } from "../db/messagesummary";
import { StatelessSessionManager } from "./session";
export declare function initializeGenerationRoutes(anthropic: Anthropic, messageDB: DrizzleMessageHistoryDB, sessionManager: StatelessSessionManager): express.Router;
