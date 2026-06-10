import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  Wifi, WifiOff, MessageSquare, ShoppingBag,
  TrendingUp, RefreshCw, Activity, Zap,
} from 'lucide-react'

interface StatusData {
  websocket: string
  features: Record<string, boolean>
  scheduler: { activeJobs: number }
  session: { userId: string; deviceId: string }
  signService: string
}

interface ReplyStats {
  totalReplied: number
  uniqueBuyers: number
}

interface DeliverStats {
  totalDelivered: number
  uniqueBuyers: number
}

export default function Dashboard() {
  const [status, setStatus] = useState<StatusData | null>(null)
  const [replyStats, setReplyStats] = useState<ReplyStats>({ totalReplied: 0, uniqueBuyers: 0 })
  const [deliverStats, setDeliverStats] = useState<DeliverStats>({ totalDelivered: 0, uniqueBuyers: 0 })
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const [s, r, d] = await Promise.all([
        api.getStatus(),
        api.getReplyStats(),
        api.getDeliverStats(),
      ])
      setStatus(s)
      setReplyStats(r.data)
      setDeliverStats(d.data)
    } catch (e) {
      console.error('Failed to load dashboard', e)
    }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const wsConnected = status?.websocket === 'connected'

  const features = [
    { key: 'autoReply', label: '自动回复', color: 'blue' },
    { key: 'autoPolish', label: '自动擦亮', color: 'green' },
    { key: 'priceMonitor', label: '价格监控', color: 'purple' },
    { key: 'dataScrape', label: '数据采集', color: 'yellow' },
    { key: 'autoDeliver', label: '自动发货', color: 'pink' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">仪表盘</h2>
          <p className="text-sm text-gray-500 mt-1">系统运行状态总览</p>
        </div>
        <button onClick={refresh} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* Connection Status */}
      <div className="card flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          wsConnected ? 'bg-green-50' : 'bg-red-50'
        }`}>
          {wsConnected ? (
            <Wifi className="w-6 h-6 text-green-600" />
          ) : (
            <WifiOff className="w-6 h-6 text-red-600" />
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">WebSocket 连接</h3>
          <p className="text-sm text-gray-500">
            {wsConnected ? '已连接到闲鱼消息服务器' : '未连接'}
          </p>
        </div>
        <span className={wsConnected ? 'badge-green' : 'badge-red'}>
          {wsConnected ? '在线' : '离线'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-blue-500">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-medium">自动回复</span>
          </div>
          <span className="stat-value">{replyStats.totalReplied}</span>
          <span className="stat-label">{replyStats.uniqueBuyers} 位买家</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-green-500">
            <ShoppingBag className="w-5 h-5" />
            <span className="text-sm font-medium">自动发货</span>
          </div>
          <span className="stat-value">{deliverStats.totalDelivered}</span>
          <span className="stat-label">{deliverStats.uniqueBuyers} 位买家</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-purple-500">
            <Activity className="w-5 h-5" />
            <span className="text-sm font-medium">定时任务</span>
          </div>
          <span className="stat-value">{status?.scheduler.activeJobs ?? 0}</span>
          <span className="stat-label">活跃任务数</span>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-yellow-500">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-medium">签名服务</span>
          </div>
          <span className="stat-value text-lg">{status?.signService ?? '-'}</span>
          <span className="stat-label">API 签名端点</span>
        </div>
      </div>

      {/* Features Toggle Status */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">功能模块状态</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {features.map((f) => {
            const enabled = status?.features?.[f.key] ?? false
            return (
              <div
                key={f.key}
                className={`flex items-center gap-3 p-3 rounded-xl border ${
                  enabled ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className={`text-sm ${enabled ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                  {f.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Session Info */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-3">会话信息</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">用户 ID：</span>
            <span className="text-gray-900 font-mono">{status?.session.userId || '-'}</span>
          </div>
          <div>
            <span className="text-gray-500">设备 ID：</span>
            <span className="text-gray-900 font-mono">{status?.session.deviceId || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
