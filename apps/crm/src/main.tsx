import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './assets/styles/reset.scss'
import './assets/styles/globals.scss'
import App from './App.tsx'
import { CunninghamProvider } from '@openfun/cunningham-react';
import { GristProvider } from '@grist-widgets/ui';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CunninghamProvider theme="dsfr-light">
      <GristProvider>
        <App />
      </GristProvider>
    </CunninghamProvider>
  </StrictMode>,
)
