import dotenv from 'dotenv';
dotenv.config();

import { app } from './src/app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 SAKU KAMPUS UMY - Finance Tracker Chatbot (Team 7)`);
  console.log(`🌐 Server running at: http://localhost:${PORT}`);
  console.log(`📚 Stack: Node.js + Express + SQLite/MySQL + Tailwind + Chart.js`);
  console.log(`=======================================================`);
});
