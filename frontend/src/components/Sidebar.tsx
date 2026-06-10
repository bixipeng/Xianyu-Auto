import type { TabId } from '../App'
import {
  LayoutDashboard,
  ShoppingBag,
  MessageSquare,
  KeyRound,
  Package,
  Settings,
  Fish,
} from 'lucide-react'

const menuItems: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
  { id: 'products', label: '商品管理', icon: ShoppingBag },
  { id: 'messages', label: '消息中心', icon: MessageSquare },
  { id: 'keywords', label: '关键词规则', icon: KeyRound },
  { id: 'deliver', label: '自动发货', icon: Package },
  { id: 'settings', label: '系统设置', icon: Settings },
]

interface Props {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

export default function Sidebar({ activeTab, onTabChange }: Props) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center">
          <Fish className="w-6 h-6 text-gray-900" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 text-lg leading-tight">闲鱼管家</h1>
          <p className="text-xs text-gray-400">XianYu Auto</p>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-3 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand text-gray-900 shadow-sm scale-[1.02]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-100">
        <p className="text-xs text-gray-400 text-center">v1.0.0</p>
      </div>
    </aside>
  )
}
