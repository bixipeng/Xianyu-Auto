import { useState, useEffect, useRef } from 'react'
import { api } from '../api'
import { MessageSquare, User, Clock, Send, RefreshCw, WifiOff, ChevronDown } from 'lucide-react'

interface ChatMessage {
  sessionId: string
  buyerId: string
  buyerName: string
  itemId: string
  content: string
  timestamp: number
  messageId: string
  direction?: 'in' | 'out'
  autoReplied?: boolean
  replyContent?: string
}

export default function Messages() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [manualBuyer, setManualBuyer] = useState('')
  const [manualContent, setManualContent] = useState('')
  const [sending, setSending] = useState(false)

  const loadMessages = async (append = false) => {
    setLoading(true)
    try {
      const offset = append ? messages.length : 0
      const res = await api.getMessages(50, offset)
      const data = res.data || []
      setTotal(res.total || data.length)
      if (append) {
        setMessages((prev) => [...prev, ...data])
      } else {
        setMessages(data)
      }
      setHasMore(offset + data.length < (res.total || 0))
    } catch (e) {
      console.error('Failed to load messages', e)
    }
    setLoading(false)
  }

  useEffect(() => { loadMessages() }, [])

  // SSE for real-time messages
  useEffect(() => {
    const evtSource = new EventSource('/api/messages/stream')
    evtSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'connected') return
        setMessages((prev) => [msg, ...prev].slice(0, 200))
        setTotal((prev) => prev + 1)
      } catch {}
    }
    evtSource.onerror = () => {
      evtSource.close()
    }
    return () => evtSource.close()
  }, [])

  const handleSend = async () => {
    if (!manualBuyer.trim() || !manualContent.trim()) return
    setSending(true)
    try {
      await api.sendReply(manualBuyer.trim(), manualContent.trim())
      setManualBuyer('')
      setManualContent('')
    } catch (e) {
      console.error('Send failed', e)
    }
    setSending(false)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">消息中心</h2>
          <p className="text-sm text-gray-500 mt-1">查看实时买家消息，支持手动回复</p>
        </div>
        <button onClick={() => loadMessages()} className="btn-secondary flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-2 card p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              最近消息
            </h3>
            <span className="badge-blue">{total} 条</span>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {messages.length === 0 && !loading ? (
              <div className="text-center py-16">
                <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400">暂无消息</p>
                <p className="text-xs text-gray-300 mt-1">等待买家发消息，消息将实时显示并持久保存</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {messages.map((msg, i) => (
                  <div key={msg.messageId || i} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {msg.buyerName || msg.buyerId?.slice(0, 8)}
                          </span>
                          {msg.autoReplied && (
                            <span className="badge-green text-[10px]">自动回复</span>
                          )}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{msg.content}</p>
                        {msg.itemId && (
                          <p className="text-xs text-gray-400 mt-1 font-mono">商品: {msg.itemId}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {hasMore && (
            <div className="px-6 py-3 border-t border-gray-100 text-center">
              <button
                onClick={() => loadMessages(true)}
                disabled={loading}
                className="text-sm text-brand hover:underline flex items-center gap-1 mx-auto"
              >
                <ChevronDown className="w-4 h-4" />
                {loading ? '加载中...' : '加载更多历史消息'}
              </button>
            </div>
          )}
        </div>

        {/* Manual Reply Panel */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Send className="w-4 h-4" />
            手动回复
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">买家 ID</label>
              <input
                value={manualBuyer}
                onChange={(e) => setManualBuyer(e.target.value)}
                placeholder="输入买家 ID"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">回复内容</label>
              <textarea
                value={manualContent}
                onChange={(e) => setManualContent(e.target.value)}
                placeholder="输入回复内容..."
                rows={4}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={sending || !manualBuyer.trim() || !manualContent.trim()}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sending ? '发送中...' : '发送回复'}
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-medium text-gray-500 mb-2">快捷操作</h4>
            <div className="space-y-2">
              {['您好，商品还在的~', '可以包邮哦~', '好的，马上给您处理！'].map((text) => (
                <button
                  key={text}
                  onClick={() => setManualContent(text)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
