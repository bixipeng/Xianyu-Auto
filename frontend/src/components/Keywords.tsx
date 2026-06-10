import { useState, useEffect } from 'react'
import { api } from '../api'
import { KeyRound, Plus, Trash2, Save, MessageSquare, X } from 'lucide-react'

interface ReplyRule {
  keywords: string[]
  reply: string
}

export default function Keywords() {
  const [rules, setRules] = useState<ReplyRule[]>([])
  const [defaultReply, setDefaultReply] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newKeywords, setNewKeywords] = useState('')
  const [newReply, setNewReply] = useState('')

  const load = async () => {
    try {
      const res = await api.getReplyRules()
      setRules(res.data.rules || [])
      setDefaultReply(res.data.defaultReply || '')
      setEnabled(res.data.enabled)
    } catch (e) {
      console.error('Failed to load rules', e)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.updateReplyRules({ rules, defaultReply })
    } catch (e) {
      console.error('Save failed', e)
    }
    setSaving(false)
  }

  const handleAdd = () => {
    if (!newKeywords.trim() || !newReply.trim()) return
    const keywords = newKeywords.split(/[,，、]/).map((k) => k.trim()).filter(Boolean)
    setRules([...rules, { keywords, reply: newReply.trim() }])
    setNewKeywords('')
    setNewReply('')
    setShowAdd(false)
  }

  const handleDelete = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">关键词规则</h2>
          <p className="text-sm text-gray-500 mt-1">配置自动回复的关键词匹配规则</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            添加规则
          </button>
        </div>
      </div>

      {/* Default Reply */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            默认回复
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {enabled ? '已启用' : '已关闭'}
            </span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`toggle-switch ${enabled ? 'toggle-switch-on' : 'toggle-switch-off'}`}
            >
              <span className={`toggle-dot ${enabled ? 'toggle-dot-on' : 'toggle-dot-off'}`} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mb-2">当没有匹配到任何关键词规则时，使用此回复</p>
        <textarea
          value={defaultReply}
          onChange={(e) => setDefaultReply(e.target.value)}
          rows={2}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent resize-none"
          placeholder="输入默认回复内容..."
        />
      </div>

      {/* Rules Grid */}
      {rules.length === 0 ? (
        <div className="card text-center py-12">
          <KeyRound className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">暂无关键词规则</p>
          <p className="text-sm text-gray-400 mt-1">点击上方"添加规则"开始配置</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule, index) => (
            <div key={index} className="card group relative">
              <button
                onClick={() => handleDelete(index)}
                className="absolute top-4 right-4 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {rule.keywords.map((kw, ki) => (
                  <span key={ki} className="badge-yellow">{kw}</span>
                ))}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{rule.reply}</p>
            </div>
          ))}
        </div>
      )}

      {/* Save Button */}
      <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
        <Save className="w-4 h-4" />
        {saving ? '保存中...' : '保存所有规则'}
      </button>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-gray-900">添加关键词规则</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  关键词（多个关键词用逗号分隔）
                </label>
                <input
                  value={newKeywords}
                  onChange={(e) => setNewKeywords(e.target.value)}
                  placeholder="例如：包邮, 发货, 价格"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">回复内容</label>
                <textarea
                  value={newReply}
                  onChange={(e) => setNewReply(e.target.value)}
                  placeholder="输入匹配后的回复内容..."
                  rows={3}
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
