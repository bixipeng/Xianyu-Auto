import { useState, useEffect } from 'react'
import { api } from '../api'
import {
  RefreshCw, Sparkles, Eye, Heart,
  MoreHorizontal, ArrowDown, Trash2, WifiOff,
  ShoppingBag,
} from 'lucide-react'

interface Product {
  itemId: string
  title: string
  description: string
  price: number
  originalPrice?: number
  images: string[]
  status: 'online' | 'offline' | 'sold'
  listedAt: number
  views?: number
  likes?: number
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [polishing, setPolishing] = useState<string | null>(null)
  const [polishAll, setPolishAll] = useState(false)
  const [error, setError] = useState<string>('')

  const loadProducts = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getProducts(1, 20)
      const data = res.data || []
      setProducts(data)
    } catch (e: any) {
      console.error('[Products] Failed to load products', e)
      setError(e?.message || String(e))
    }
    setLoading(false)
  }

  useEffect(() => {
    loadProducts()
  }, [])

  const handlePolish = async (itemId: string) => {
    setPolishing(itemId)
    try {
      await api.polishProduct(itemId)
    } catch (e) {
      console.error('Polish failed', e)
    }
    setPolishing(null)
  }

  const handlePolishAll = async () => {
    setPolishAll(true)
    try {
      await api.polishAll()
      await loadProducts()
    } catch (e) {
      console.error('Polish all failed', e)
    }
    setPolishAll(false)
  }

  const handleOffline = async (itemId: string) => {
    try {
      await api.offlineProduct(itemId)
      await loadProducts()
    } catch (e) {
      console.error('Offline failed', e)
    }
  }

  const handleDelete = async (itemId: string) => {
    if (!confirm('确定要删除此商品吗？')) return
    try {
      await api.deleteProduct(itemId)
      await loadProducts()
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  const statusMap: Record<string, { label: string; cls: string }> = {
    online: { label: '在售', cls: 'badge-green' },
    offline: { label: '下架', cls: 'badge-gray' },
    sold: { label: '已售', cls: 'badge-blue' },
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">商品管理</h2>
          <p className="text-sm text-gray-500 mt-1">管理你的闲鱼商品，擦亮、下架、删除</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadProducts} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </button>
          <button onClick={handlePolishAll} disabled={polishAll} className="btn-primary flex items-center gap-2">
            <Sparkles className={`w-4 h-4 ${polishAll ? 'animate-spin' : ''}`} />
            {polishAll ? '擦亮中...' : '一键擦亮'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          加载失败: {error}
        </div>
      )}

      {loading && products.length === 0 ? (
        <div className="card text-center py-16">
          <RefreshCw className="w-8 h-8 text-gray-300 animate-spin mx-auto mb-3" />
          <p className="text-gray-400">加载商品中...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="card text-center py-16">
          <WifiOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">暂无商品数据</p>
          <p className="text-sm text-gray-400 mt-1">请确认账号已发布商品，点击刷新重试</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">商品</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">价格</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">状态</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">浏览</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">喜欢</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-4">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map((p) => (
                <tr key={p.itemId} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.images?.[0] ? (
                        <img src={p.images[0]} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <ShoppingBag className="w-5 h-5 text-gray-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{p.title}</p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono">{p.itemId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-semibold text-red-600">¥{p.price}</span>
                    {p.originalPrice && p.originalPrice > p.price && (
                      <span className="text-xs text-gray-400 line-through ml-2">¥{p.originalPrice}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={statusMap[p.status]?.cls || 'badge-gray'}>
                      {statusMap[p.status]?.label || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {p.views ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-gray-600 flex items-center justify-center gap-1">
                      <Heart className="w-3.5 h-3.5" />
                      {p.likes ?? 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handlePolish(p.itemId)}
                        disabled={polishing === p.itemId}
                        className="p-2 rounded-lg hover:bg-yellow-50 text-gray-400 hover:text-yellow-600 transition-colors"
                        title="擦亮"
                      >
                        <Sparkles className={`w-4 h-4 ${polishing === p.itemId ? 'animate-spin' : ''}`} />
                      </button>
                      {p.status === 'online' && (
                        <button
                          onClick={() => handleOffline(p.itemId)}
                          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="下架"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.itemId)}
                        className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
