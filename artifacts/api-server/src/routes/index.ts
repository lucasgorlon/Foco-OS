import { Router, type IRouter } from "express";
import automationsRouter from "./automations";
import authRouter from "./auth";
import docsRouter from "./docs";
import focoRouter from "./foco";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(focoRouter);
router.use(automationsRouter);
router.use(docsRouter);

export default router;
