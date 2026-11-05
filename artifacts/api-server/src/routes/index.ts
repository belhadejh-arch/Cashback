import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cashbackRouter from "./cashback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cashbackRouter);

export default router;
