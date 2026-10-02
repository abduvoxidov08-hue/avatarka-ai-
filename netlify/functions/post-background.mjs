// Background Function (15 daqiqagacha ishlay oladi). Fayl nomidagi "-background" shart.
import { checkAdmin } from "./lib/auth.mjs";
import { runPost } from "./lib/poster.mjs";
import { createStore } from "./lib/store.mjs";

export default async (req) => {
  const auth = checkAdmin(req);
  if (!auth.ok) return new Response(auth.message, { status: auth.status });
  const source = new URL(req.url).searchParams.get("source") === "scheduled" ? "scheduled" : "manual";
  await runPost({ store: createStore(), source });
};
