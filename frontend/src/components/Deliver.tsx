import { useState, useEffect } from 'react'
import { api } from '../api'
import { Package, Plus, Trash2, Save, X, Send } from 'lucide-react'

interface DeliverRule {
  itemId: string
  keywords: string[]
  deliverContent: string
}

interface DeliverStats {
  totalDelivered: number
  uniqueBuyers: number
}

export default function Deliver() {
  const [rules, setRules] = useState<DeliverRule[]>([])
  const [stats, setStats] = useState<DeliverStats>({ totalDelivered: 0, uniqueBuyers: 0 })
  const [enabled, setEnabled] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newItemId, setNewItemId] = useState('')
  const [newKeywords, setNewKeywords] = useState('')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [r, s] = await Promise.all([api.getDeliverRules(), api.getDeliverStats()])
      setRules(r.data.rules || [])
      setEnabled(r.data.enabled)
      setStats(s.data)
    } catch (e) {
      console.error('Failed to load deliver data', e)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateDeliverRules({ rules })
    } catch (e) {
      console.error('Save failed', e)
    }
    setSaving(false)
  }

  const handleAdd = () => {
    if (!newItemId.trim() || !newContent.trim()) return
    const keywords = newKeywords.split(/[,，、]/).map((k) => k.trim()).filter(Boolean)
    setRules([...rules, { itemId: newItemId.trim(), keywords, deliverContent: newContent.trim() }])
    setNewItemId('')
    setNewKeywords('')
    setNewContent('')
    setShowAdd(false)
  }

  const handleDelete = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">自动发货</h2>
          <p className="text-sm text-gray-500 mt-1">配置数字商品的自动发货规则</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          添加规则
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-green-500">
            <Send className="w-5 h-5" />
            <span className="text-sm font-medium">已发货</span>
          </div>
          <span className="stat-value">{stats.totalDelivered}</span>
          <span className="stat-label">{stats.uniqueBuyers} 位买家</span>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-blue-500">
            <Package className="w-5 h-5" />
            <span className="text-sm font-medium">规则数</span>
          </div>
          <span className="stat-value">{rules.length}</span>
          <span className="stat-label">
            {enabled ? '功能已启用' : '功能未启用'}
          </span>
        </div>
      </div>

      {/* Rules */}
      {rules.length === 0 ? (
        <div className="card text-center py-12">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">暂无发货规则</p>
          <p className="text-sm text-gray-400 mt-1">添加规则后，买家下单将自动发送数字商品</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, index) => (
            <div key={index} className="card group">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-sm text-gray-900 bg-gray-100 px-2 py-0.5 rounded-lg">
                      {rule.itemId}
                    </span>
                    {rule.keywords.map((kw, ki) => (
                      <span key={ki} className="badge-yellow">{kw}</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2 mt-2">
                    {rule.deliverContent}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(index)}
                  className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all ml-3"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存规则'}
      </button>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">添加发货规则</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">商品 ID</label>
                <input
                  value={newItemId}
                  onChange={(e) => setNewItemId(e.target.value)}
                  placeholder="输入商品 ID"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  触发关键词（可选，逗号分隔）
                </label>
                <input
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="例如：下单, 购买"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">发货内容</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="输入要发送的数字商品内容（如下载链接、激活码等）..."
                  rows={4}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAdd(false)} className="btn-secondary flex-1">取消</button>
                <button onClick={handleAdd} className="btn-primary flex-1">添加</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
