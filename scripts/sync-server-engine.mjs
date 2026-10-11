import { copyFileSync } from 'node:fs'
copyFileSync(new URL('../src/carematch/engine.mjs', import.meta.url),
  new URL('../supabase/functions/carematch-api/engine.mjs', import.meta.url))
copyFileSync(new URL('../src/carematch/safety.mjs', import.meta.url),
  new URL('../supabase/functions/carematch-api/safety.mjs', import.meta.url))
