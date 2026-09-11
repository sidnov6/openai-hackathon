import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiProvider } from './api/ApiProvider'
import { CitationProvider } from './components/common/Citation'
import { JourneyProvider } from './state/journey'
import { App } from './App'
import './styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <ApiProvider>
      <JourneyProvider>
        <CitationProvider>
          <App />
        </CitationProvider>
      </JourneyProvider>
    </ApiProvider>
  </StrictMode>,
)
