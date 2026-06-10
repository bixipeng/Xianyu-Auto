import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Messages from './components/Messages'
import Keywords from './components/Keywords'
import Deliver from './components/Deliver'
import Settings from './components/Settings'

export type TabId = 'dashboard' | 'products' | 'messages' | 'keywords' | 'deliver' | 'settings'

const validTabs: TabId[] = ['dashboard', 'products', 'messages', 'keywords', 'deliver', 'settings']

function getTabFromHash(): TabId {
  const hash = window.location.hash.replace('#', '').replace('/', '')
  return validTabs.includes(hash as TabId) ? (hash as TabId) : 'dashboard'
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>(getTabFromHash)

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const handleTabChange = (tab: TabId) => {
    window.location.hash = tab
    setActiveTab(tab)
  }

  const renderPage = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'products': return <Products />
      case 'messages': return <Messages />
      case 'keywords': return <Keywords />
      case 'deliver': return <Deliver />
      case 'settings': return <Settings />
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  )
}
