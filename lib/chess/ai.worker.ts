import { chooseMove } from './ai';
self.onmessage = ({ data }) => {
  try { self.postMessage({ move: chooseMove(data.position, data.rules, data.difficulty) }); }
  catch { self.postMessage({ error: 'The AI could not finish its move. Please try again.' }); }
};
