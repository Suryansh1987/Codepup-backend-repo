import express from "express";
import { RedisService } from '../services/Redis';
export declare function initializeRedisRoutes(redis: RedisService): express.Router;
