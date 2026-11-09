import { Router, type IRouter } from "express";
import healthRouter from "./health";
import cashbackRouter from "./cashback";
import cashbackMerchantRouter from "./cashback-merchant";

const router: IRouter = Router();

router.use(healthRouter);
router.use(cashbackMerchantRouter);
router.use(cashbackRouter);

export default router;
