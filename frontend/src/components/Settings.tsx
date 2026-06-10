import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  Settings as SettingsIcon, Save, RefreshCw,
  Server, Shield, Bell, Sliders,
} from 'lucide-react'

export default function Settings() {
  const [config, setConfig] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restartNeeded, setRestartNeeded] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await api.getConfig()
      setConfig(res.data || {})
    } catch (e) {
      console.error('Failed to load config', e)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateField = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      const res = await api.updateConfig(config)
      setSaveMsg('保存成功！')
      if (res.needsRestart) {
        setRestartNeeded(true)
      }
    } catch (e) {
      setSaveMsg('保存失败')
    }
    setSaving(false)
    setTimeout(() => setSaveMsg(''), 3000)
  }

  const handleRestart = async () => {
    try {
      await api.restartScheduler()
      setRestartNeeded(false)
      setSaveMsg('调度器已重启')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) {
      console.error('Restart failed', e)
    }
  }

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!value)}
      className={`toggle-switch ${value ? 'toggle-switch-on' : 'toggle-switch-off'}`}
    >
      <span className={`toggle-dot ${value ? 'toggle-dot-on' : 'toggle-dot-off'}`} />
    </button>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 text-gray-300 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
          <p className="text-sm text-gray-500 mt-1">配置系统参数和功能开关</p>
        </div>
        <div className="flex gap-2">
          {restartNeeded && (
            <button onClick={handleRestart} className="btn-secondary flex items-center gap-2 text-yellow-700">
              <RefreshCw className="w-4 h-4" />
              重启调度器
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={`text-sm px-4 py-2 rounded-xl ${
          saveMsg.includes('失败') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
        }`}>
          {saveMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Feature Toggles */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            功能开关
          </h3>
          <div className="space-y-4">
            {[
              { key: 'autoReplyEnabled', label: '自动回复', desc: '收到消息后自动回复买家' },
              { key: 'autoPolishEnabled', label: '自动擦亮', desc: '定时擦亮商品提升曝光' },
              { key: 'priceMonitorEnabled', label: '价格监控', desc: '监控商品价格变动' },
              { key: 'dataScrapeEnabled', label: '数据采集', desc: '采集市场数据用于分析' },
              { key: 'autoDeliverEnabled', label: '自动发货', desc: '买家下单后自动发送数字商品' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <Toggle
                  value={config[item.key] ?? false}
                  onChange={(v) => updateField(item.key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Intervals */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="w-4 h-4" />
            定时间隔
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">擦亮间隔（小时）</label>
              <input
                type="number"
                value={config.polishIntervalHours ?? 8}
                onChange={(e) => updateField('polishIntervalHours', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">价格检查间隔（分钟）</label>
              <input
                type="number"
                value={config.priceCheckIntervalMinutes ?? 30}
                onChange={(e) => updateField('priceCheckIntervalMinutes', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">数据采集间隔（小时）</label>
              <input
                type="number"
                value={config.scrapeIntervalHours ?? 6}
                onChange={(e) => updateField('scrapeIntervalHours', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">日志级别</label>
              <select
                value={config.logLevel ?? 'info'}
                onChange={(e) => updateField('logLevel', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-white"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
        </div>

        {/* Connection */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Server className="w-4 h-4" />
            连接配置
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">签名服务地址</label>
              <input
                value={config.xSignServiceUrl ?? ''}
                onChange={(e) => updateField('xSignServiceUrl', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">API 基础地址</label>
              <input
                value={config.apiBaseUrl ?? ''}
                onChange={(e) => updateField('apiBaseUrl', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">WebSocket 地址</label>
              <input
                value={config.wsUrl ?? ''}
                onChange={(e) => updateField('wsUrl', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>
        </div>

        {/* Auth Info (read-only) */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            认证信息
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">用户 ID</label>
              <input
                value={config.userId ?? ''}
                readOnly
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cookie</label>
              <input
                value={config.cookie ?? ''}
                readOnly
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Token</label>
              <input
                value={config.token ?? ''}
                readOnly
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-mono bg-gray-50 text-gray-500"
              />
            </div>
            <p className="text-xs text-gray-400">认证信息从 .env 文件加载，修改请编辑 .env 后重启服务</p>
          </div>
        </div>
      </div>
    </div>
  )
}
