import './styles.css';
import { createRoot } from 'react-dom/client';
import App from './App';

const container = document.querySelector('#root');
const root = createRoot(container!);
root.render(
  // <React.StrictMode>
  <App />
  // </React.StrictMode>
);
