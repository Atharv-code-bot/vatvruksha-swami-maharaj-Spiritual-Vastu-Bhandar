import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { AlertTriangle, RefreshCw, Search } from 'lucide-react'
import { useAdminAuth } from '../context/AuthContext'
import { fetchProducts } from '../functions/queries'
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../../shared/constants.js'
import { formatINR } from '../../../shared/money.js'

const PAGE_SIZE = 500

function normalizeSearch(value) {
  return String(value ?? '').trim().toLowerCase()
}

function getStock(value) {
  const stock = Number(value ?? 0)
  return Number.isFinite(stock) && stock >= 0 ? stock : 0
}

export default function InventoryPage() {
  const { user } = useAdminAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [stockFilter, setStockFilter] = useState('all')

  const loadInventory = useCallback(async ({ quiet = false } = {}) => {
    if (!user) {
      setProducts([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      // Fetch every page so inventory totals are not silently capped at PAGE_SIZE.
      const allProducts = []
      let cursor = null
      let hasMore = true

      while (hasMore) {
        const result = await fetchProducts({
          pageSize: PAGE_SIZE,
          ...(cursor ? { lastDoc: cursor } : {}),
        })

        const items = Array.isArray(result?.items) ? result.items : []
        allProducts.push(...items)

        hasMore = Boolean(result?.hasMore)
        cursor = result?.lastDoc ?? result?.lastVisible ?? null

        // Guard against a broken query helper that reports more pages but
        // doesn't return a cursor; avoid an accidental infinite loop.
        if (hasMore && !cursor) {
          throw new Error(
            'Inventory could not load all products because the pagination cursor was missing. Please retry or check the product query helper.'
          )
        }
      }

      setProducts(allProducts)
    } catch (err) {
      setError(err?.message || 'Could not load inventory. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadInventory()
  }, [loadInventory])

  const variantRows = useMemo(() => {
    const query = normalizeSearch(searchQuery)
    const rows = []

    for (const product of products) {
      const variants = product?.variants && typeof product.variants === 'object'
        ? product.variants
        : {}

      for (const [variantId, variantValue] of Object.entries(variants)) {
        const variant = variantValue && typeof variantValue === 'object'
          ? variantValue
          : {}
        const stock = getStock(variant.stock)
        const isLowStock =
          stock > 0 && stock <= DEFAULT_LOW_STOCK_THRESHOLD
        const isOOS = stock === 0
        const productName = String(product?.name ?? 'Unnamed product')
        const label = String(variant.label ?? variantId)

        const matchesSearch =
          !query ||
          productName.toLowerCase().includes(query) ||
          variantId.toLowerCase().includes(query) ||
          label.toLowerCase().includes(query)

        if (!matchesSearch) continue

        const isInactive =
          product.isActive === false || variant.isActive === false

        if (stockFilter === 'low' && !isLowStock) continue
        if (stockFilter === 'out' && !isOOS) continue
        if (stockFilter === 'inStock' && (isOOS || isLowStock || isInactive)) continue
        if (stockFilter === 'inactive' && !isInactive) continue

        rows.push({
          productId: product.id,
          productName,
          variantId,
          label,
          stock,
          isActive: variant.isActive !== false,
          productIsActive: product.isActive !== false,
          isLowStock,
          isOOS,
          price: Number(variant.price ?? 0),
        })
      }
    }

    // Prioritize out-of-stock, then low-stock variants, then product name.
    rows.sort((a, b) => {
      if (a.isOOS !== b.isOOS) return a.isOOS ? -1 : 1
      if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1
      return a.productName.localeCompare(b.productName)
    })

    return rows
  }, [products, searchQuery, stockFilter])

  const lowStockCount = variantRows.filter((row) => row.isLowStock).length
  const outOfStockCount = variantRows.filter((row) => row.isOOS).length
  const inactiveCount = variantRows.filter(
    (row) => !row.productIsActive || !row.isActive
  ).length

  const handleRefresh = () => loadInventory({ quiet: true })

  return (
    <>
      <Helmet>
        <title>Inventory — Vatvruksha Admin</title>
      </Helmet>

      {loading && products.length === 0 ? (
        <div className="space-y-4">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-40 w-full rounded-2xl" />
          <p className="text-sm text-brown-light">Loading inventory…</p>
        </div>
      ) : (
      <>
      <div className="relative mb-5 min-w-0 overflow-hidden rounded-2xl border border-cream-dark bg-gradient-to-r from-white via-cream/70 to-white p-4 shadow-sm sm:mb-7 sm:p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">
          Inventory
        </p>
        <h1 className="font-serif text-3xl text-brown mt-2">Stock Overview</h1>
        <p className="text-brown-light text-sm mt-1">
          Stock is tracked for each product variant. To change a quantity, edit
          the product from the Products page.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Could not load inventory</p>
            <p className="mt-1 break-words">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="btn-ghost disabled:opacity-60"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="mb-5 grid min-w-0 grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <p className="text-xs font-semibold uppercase text-gold-dark">
            Total Variants
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-brown">
            {products.reduce(
              (total, product) =>
                total +
                Object.keys(
                  product?.variants && typeof product.variants === 'object'
                    ? product.variants
                    : {}
                ).length,
              0
            )}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <p className="text-xs font-semibold uppercase text-orange-700">
            Low Stock (1–{DEFAULT_LOW_STOCK_THRESHOLD})
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-orange-700">
            {lowStockCount}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <p className="text-xs font-semibold uppercase text-red-700">
            Out of Stock (0)
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-red-700">
            {outOfStockCount}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-maroon-100 bg-gradient-to-br from-maroon-50 to-white p-3 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5">
          <p className="text-xs font-semibold uppercase text-maroon">
            Inactive Variants/Products
          </p>
          <p className="mt-1 font-serif text-2xl font-bold text-brown">
            {inactiveCount}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 rounded-2xl border border-cream-dark bg-white p-2.5 shadow-sm sm:p-3" role="group" aria-label="Filter inventory by stock status">
        {[
          { value: 'all', label: 'All variants' },
          { value: 'low', label: 'Low stock' },
          { value: 'out', label: 'Out of stock' },
          { value: 'inStock', label: 'In stock' },
          { value: 'inactive', label: 'Inactive' },
        ].map((filter) => {
          const selected = stockFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setStockFilter(filter.value)}
              className={`rounded-full border px-3 py-2 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                selected
                  ? 'border-maroon bg-maroon text-white'
                  : 'border-cream-dark bg-white text-brown hover:bg-cream'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown-light"
          />
          <input
            type="search"
            placeholder="Search product or variant…"
            aria-label="Search products or variants"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-cream-dark bg-cream py-2.5 pl-9 pr-3 text-brown shadow-sm transition focus:border-gold focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
          <p className="text-xs text-brown-light">
            {variantRows.length} matching variants · {products.length} products loaded
          </p>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-ghost disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-3 xl:hidden">
        {variantRows.map((row) => {
          let statusClass = 'bg-cream text-brown border-cream-dark'
          let statusText = 'In Stock'

          if (!row.productIsActive || !row.isActive) {
            statusClass = 'status-cancelled'
            statusText = 'Inactive'
          } else if (row.isOOS) {
            statusClass = 'status-expired'
            statusText = 'Out of Stock'
          } else if (row.isLowStock) {
            statusClass = 'status-pending_payment'
            statusText = 'Low Stock'
          }

          return (
            <article
              key={`${row.productId}-${row.variantId}`}
              className="min-w-0 rounded-2xl border border-cream-dark bg-white p-3 shadow-sm sm:p-4"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-sm font-semibold text-brown sm:text-base">
                    {row.productName}
                  </h2>
                  <p className="mt-1 break-words text-xs text-brown-light">
                    Variant: {row.label}
                  </p>
                </div>
                <span className={`badge status-badge shrink-0 ${statusClass}`}>
                  {statusText}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-cream-dark pt-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-brown-light">Stock</p>
                  <p className={`mt-1 text-sm font-semibold ${
                    row.isOOS
                      ? 'text-red-700'
                      : row.isLowStock
                        ? 'text-orange-700'
                        : 'text-brown'
                  }`}>
                    {row.stock}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-brown-light">Price</p>
                  <p className="mt-1 break-words text-sm font-semibold text-brown">
                    {formatINR(row.price)}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-brown-light">Product status</p>
                  <p className="mt-1 text-sm font-medium text-brown">
                    {row.productIsActive ? 'Active' : 'Inactive'}
                    {!row.isActive && row.productIsActive ? ' · Variant inactive' : ''}
                  </p>
                </div>
              </div>
            </article>
          )
        })}

        {!loading && !error && variantRows.length === 0 && (
          <div className="rounded-2xl border border-cream-dark bg-white px-4 py-10 text-center text-sm text-brown-light">
            {searchQuery
              ? 'No variants match your search.'
              : 'No product variants found.'}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-sm transition-shadow duration-200 hover:shadow-md xl:block">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th className="w-64">Product</th>
                <th className="w-32">Variant</th>
                <th className="w-24">Stock</th>
                <th className="w-32">Status</th>
                <th className="w-32">Price</th>
              </tr>
            </thead>
            <tbody>
              {variantRows.map((row) => {
                let statusClass = 'bg-cream text-brown border-cream-dark'
                let statusText = 'In Stock'

                if (!row.productIsActive || !row.isActive) {
                  statusClass = 'status-cancelled'
                  statusText = 'Inactive'
                } else if (row.isOOS) {
                  statusClass = 'status-expired'
                  statusText = 'Out of Stock'
                } else if (row.isLowStock) {
                  statusClass = 'status-pending_payment'
                  statusText = 'Low Stock'
                }

                return (
                  <tr
                    key={`${row.productId}-${row.variantId}`}
                    className="border-b border-cream-dark transition-colors duration-200 hover:bg-cream/70"
                  >
                    <td className="font-medium text-brown">
                      {row.productName}
                    </td>
                    <td className="font-medium text-brown">
                      {row.label}
                    </td>
                    <td
                      className={`font-semibold ${
                        row.isOOS
                          ? 'text-red-700'
                          : row.isLowStock
                            ? 'text-orange-700'
                            : 'text-brown'
                      }`}
                    >
                      {row.stock}
                    </td>
                    <td>
                      <span className={`badge status-badge ${statusClass}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="text-brown-light">{formatINR(row.price)}</td>
                  </tr>
                )
              })}

              {!loading && !error && variantRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-brown-light">
                    {searchQuery
                      ? 'No variants match your search.'
                      : 'No product variants found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
      )}

    </>
  )
}
