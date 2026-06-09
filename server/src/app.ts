import express, { type Express } from 'express';
import { NoteStore } from './store.js';
import { createNotesRouter } from './notes.js';

export function createApp(store: NoteStore = new NoteStore()): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/notes', createNotesRouter(store));
  return app;
}
