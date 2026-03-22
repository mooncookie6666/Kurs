import { Router, type IRouter } from "express";
import healthRouter from "./health";
import localAuthRouter from "./local-auth";
import itemsRouter from "./items";

const router: IRouter = Router();

router.use(healthRouter);
router.use(localAuthRouter);
router.use(itemsRouter);

export default router;
