import { svgToPngBuffer } from "bookfig/node";

type Body = {
  svg?: unknown;
};

export default defineEventHandler(async (event) => {
  const body = (await readBody(event)) as Body;
  if (typeof body.svg !== "string" || !body.svg.includes("<svg")) {
    throw createError({ statusCode: 400, statusMessage: "expected { svg: string }" });
  }
  const png = svgToPngBuffer(body.svg);
  setHeader(event, "content-type", "image/png");
  return png;
});
