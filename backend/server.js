// Vercel checks that a service's entrypoint file exists in the committed
// source tree before running the build step — so it can't point directly at
// dist/main.js, which only exists after `npm run build` compiles it and
// isn't committed to git. This small wrapper IS committed, so that check
// passes; by the time it actually runs (after the build), dist/main.js
// exists and this just loads it.
require('./dist/main.js');
