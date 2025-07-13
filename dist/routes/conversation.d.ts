import express from "express";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
import { RedisService } from '../services/Redis';
import { StatelessSessionManager } from './session';
export declare function initializeConversationRoutes(messageDB: DrizzleMessageHistoryDB, redis: RedisService, sessionManager: StatelessSessionManager): express.Router;
