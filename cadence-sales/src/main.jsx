import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Apply theme before React renders to avoid a flash.
// Defaults to the time of day (day=light, night=dark); a manual toggle locks the choice.
;(function () {
  try {
    var pref = localStorage.getItem('cadence-theme-pref') || 'auto'
    var theme = pref
    if (theme === 'auto') {
      var h = new Date().getHours()
      theme = (h >= 6 && h < 19) ? 'light' : 'dark'
    }
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  } catch (e) {
    document.documentElement.classList.add('dark')
  }
})()

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)