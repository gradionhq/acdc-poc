import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
createApp().listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`notes-api listening on :${port}`);
});
