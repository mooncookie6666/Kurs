import { Router, type IRouter } from "express";
import healthRouter from "./health";
import localAuthRouter from "./local-auth";
import itemsRouter from "./items";
import uploadRouter from "./upload";
import adminRouter from "./admin";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(localAuthRouter);
router.use(itemsRouter);
router.use(uploadRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
