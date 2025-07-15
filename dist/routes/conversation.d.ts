import express from "express";
import { DrizzleMessageHistoryDB } from '../db/messagesummary';
export declare function initializeConversationRoutes(messageDB: DrizzleMessageHistoryDB): express.Router;
