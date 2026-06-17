import './assets/main.css'
import ReactDOM from 'react-dom/client'
import App from './App'

// Note: no React.StrictMode — its double-invoke of effects would spawn/kill/respawn
// every PTY on mount, racing the async spawn and leaving orphaned shell processes.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />)
