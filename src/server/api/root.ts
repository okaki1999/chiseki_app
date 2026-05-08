import { adminRouter } from "~/server/api/routers/admin";
import { postRouter } from "~/server/api/routers/post";
import { surveyMapRouter } from "~/server/api/routers/surveyMap";
import { tenantRouter } from "~/server/api/routers/tenant";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  post: postRouter,
  surveyMap: surveyMapRouter,
  tenant: tenantRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
