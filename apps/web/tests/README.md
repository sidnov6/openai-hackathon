# Browser tests

`pnpm --dir apps/web test:e2e` runs these against a production preview build.
First run needs `pnpm --dir apps/web test:e2e:install` to fetch Chromium.

They run on the **mock transport** so they are deterministic and need no credentials.
That is deliberate: the checks here are about truthfulness of the UI (sample data is
labelled, counts stay literal, absent clauses say so, no invented deadlines), which must
hold regardless of which transport is live.
