// scripts/dev-server.js - local development only. On Vercel, app.js is the entry point.
const app = require('../app');

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Carpool board on http://localhost:${port}`);
});
