import { postRouter } from "~/server/api/routers/post";
import { surveyMapRouter } from "~/server/api/routers/surveyMap";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  post: postRouter,
  surveyMap: surveyMapRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
