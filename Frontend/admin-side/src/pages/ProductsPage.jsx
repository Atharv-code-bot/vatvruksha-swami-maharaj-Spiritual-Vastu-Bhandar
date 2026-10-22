
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Plus,
  Search,
  Trash2,
  Edit2,
  EyeOff,
  Eye,
  X,
  ImagePlus,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore'
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { useAdminAuth } from '../context/AuthContext'
import { formatINR } from '../../../shared/money.js'

const VARIANT_ID_REGEX = /^[a-z0-9_]+$/
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_IMAGES = 5

const EMPTY_VARIANT = {
  label: 'Default',
  priceInput: '',
  mrpInput: '',
  stockInput: '0',
  baselineStock: 0,
  isActive: true,
  sortOrder: 0,
}

const EMPTY_PRODUCT = {
  name: '',
  description: '',
  color: '',
  categoryId: '',
  images: [],
  variants: {
    default: { ...EMPTY_VARIANT },
  },
  isActive: true,
}

function makeSlug(value = '') {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'product'
  )
}

function rupeesToPaise(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return NaN
  return Math.round((number + Number.EPSILON) * 100)
}

function paiseToRupees(value) {
  return (Number(value) || 0) / 100
}

function generateVariantId(existingVariants) {
  let id

  do {
    const randomPart =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

    id = `variant_${randomPart}`
  } while (Object.prototype.hasOwnProperty.call(existingVariants, id))

  return id
}

function getErrorMessage(error, fallback) {
  if (error?.code === 'permission-denied') {
    return 'Permission denied. Check the admin account and your existing Firebase security rules.'
  }

  if (error?.code === 'storage/unauthorized') {
    return 'Firebase Storage denied this image operation. Check your Storage rules.'
  }

  if (error?.code === 'storage/canceled') {
    return 'The image upload was cancelled.'
  }

  return error?.message || fallback
}

function getProductPriceRange(product) {
  const prices = Object.values(product.variants || {})
    .filter((variant) => variant.isActive !== false)
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isInteger(price) && price >= 0)

  if (!prices.length) return '—'

  const minimum = Math.min(...prices)
  const maximum = Math.max(...prices)

  return minimum === maximum
    ? formatINR(minimum)
    : `${formatINR(minimum)} – ${formatINR(maximum)}`
}

function getTotalStock(product) {
  return Object.values(product.variants || {}).reduce(
    (total, variant) => total + (variant.isActive !== false ? Math.max(0, Number(variant.stock) || 0) : 0),
    0
  )
}

function getVariantCount(product) {
  return Object.values(product.variants || {}).filter(
    (variant) => variant.isActive !== false
  ).length
}

export default function ProductsPage() {
  const { user, isAdmin } = useAdminAuth()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [imageUrls, setImageUrls] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [product, setProduct] = useState({ ...EMPTY_PRODUCT })
  const [newImageFiles, setNewImageFiles] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const [viewingProduct, setViewingProduct] = useState(null)

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!user || !isAdmin) {
      setProducts([])
      setCategories([])
      setImageUrls({})
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (quiet) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      // Load complete admin collections instead of stopping at the first page.
      const [productSnapshot, categorySnapshot] = await Promise.all([
        getDocs(collection(db, 'products')),
        getDocs(collection(db, 'categories')),
      ])

      const productItems = productSnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      }))

      const categoryItems = categorySnapshot.docs.map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      }))

      productItems.sort((a, b) => {
        const orderDifference =
          (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)

        return orderDifference || (a.name || '').localeCompare(b.name || '')
      })

      categoryItems.sort((a, b) => {
        const orderDifference =
          (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)

        return orderDifference || (a.name || '').localeCompare(b.name || '')
      })

      setProducts(productItems)
      setCategories(categoryItems)

      const imageEntries = await Promise.all(
        productItems.map(async (item) => {
          const paths = Array.isArray(item.images) ? item.images : []

          const urls = await Promise.all(
            paths.map(async (path) => {
              try {
                return await getDownloadURL(ref(storage, path))
              } catch {
                return ''
              }
            })
          )

          return [item.id, urls]
        })
      )

      setImageUrls(Object.fromEntries(imageEntries))
    } catch (err) {
      const message = getErrorMessage(err, 'Could not load products.')
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    const urls = newImageFiles.map((file) => URL.createObjectURL(file))
    setImagePreviews(urls)

    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [newImageFiles])

  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((item) => [item.id, item.name])),
    [categories]
  )

  const filteredProducts = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()

    if (!search) return products

    return products.filter((item) => {
      const name = (item.name || '').toLowerCase()
      const slug = (item.slug || '').toLowerCase()
      const categoryName = (categoryNames[item.categoryId] || '').toLowerCase()

      return (
        name.includes(search) ||
        slug.includes(search) ||
        categoryName.includes(search)
      )
    })
  }, [products, searchQuery, categoryNames])

  function openCreate() {
    setEditingId(null)
    setProduct({
      ...EMPTY_PRODUCT,
      images: [],
      variants: { default: { ...EMPTY_VARIANT } },
    })
    setNewImageFiles([])
    setCategorySearch('')
    setCategoryMenuOpen(false)
    setFormOpen(true)
  }

  function openEdit(item) {
    const existingVariants = Object.entries(item.variants || {})

    setEditingId(item.id)
    setProduct({
      name: item.name || '',
      description: item.description || '',
      color: item.color || '',
      categoryId: item.categoryId || '',
      images: Array.isArray(item.images) ? [...item.images] : [],
      isActive: item.isActive !== false,
      sortOrder: Number(item.sortOrder) || 0,
      slug: item.slug || '',
      variants: Object.fromEntries(
        existingVariants.map(([variantId, variant]) => [
          variantId,
          {
            label: variant.label || '',
            priceInput: variant.price == null ? '' : String(paiseToRupees(variant.price)),
            mrpInput: variant.mrp == null ? '' : String(paiseToRupees(variant.mrp)),
            stockInput: String(Math.max(0, Number(variant.stock) || 0)),
            baselineStock: Math.max(0, Number(variant.stock) || 0),
            isActive: variant.isActive !== false,
            sortOrder: Number(variant.sortOrder) || 0,
          },
        ])
      ),
    })
    setNewImageFiles([])
    setCategorySearch(categories.find((category) => category.id === item.categoryId)?.name || '')
    setCategoryMenuOpen(false)
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return

    setFormOpen(false)
    setEditingId(null)
    setProduct({ ...EMPTY_PRODUCT })
    setNewImageFiles([])
    setCategorySearch('')
    setCategoryMenuOpen(false)
  }

  function handleProductChange(event) {
    const { name, value } = event.target

    setProduct((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  function setVariantField(variantId, field, value) {
    setProduct((previous) => ({
      ...previous,
      variants: {
        ...previous.variants,
        [variantId]: {
          ...previous.variants[variantId],
          [field]: value,
        },
      },
    }))
  }

  function addVariant() {
    setProduct((previous) => {
      const variantId = generateVariantId(previous.variants)

      return {
        ...previous,
        variants: {
          ...previous.variants,
          [variantId]: {
            label: '',
            priceInput: '',
            mrpInput: '',
            stockInput: '0',
            baselineStock: 0,
            isActive: true,
            sortOrder: Object.keys(previous.variants).length,
            _isNew: true,
          },
        },
      }
    })
  }

  function removeVariant(variantId) {
    if (!product.variants[variantId]) return

    if (Object.keys(product.variants).length <= 1) {
      toast.error('A product must have at least one variant.')
      return
    }

    const variant = product.variants[variantId]
    const confirmed = window.confirm(
      `Delete variant "${variant.label || "Unnamed variant"}"? This is different from deactivating it. Save the product to apply this deletion.`
    )
    if (!confirmed) return

    setProduct((previous) => {
      const { [variantId]: removed, ...remaining } = previous.variants
      return { ...previous, variants: remaining }
    })
  }

  function handleImageSelection(event) {
    const selectedFiles = Array.from(event.target.files || [])
    event.target.value = ''

    if (!selectedFiles.length) return

    const validFiles = []

    for (const file of selectedFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: choose a JPG, PNG, or WebP image.`)
        continue
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`${file.name}: image must be 5 MB or smaller.`)
        continue
      }

      validFiles.push(file)
    }

    if (validFiles.length) {
      const availableSlots = MAX_IMAGES - product.images.length - newImageFiles.length
      if (availableSlots <= 0) {
        toast.error(`A product can have at most ${MAX_IMAGES} images.`)
        return
      }
      const acceptedFiles = validFiles.slice(0, availableSlots)
      if (acceptedFiles.length < validFiles.length) {
        toast.error(`Only ${availableSlots} more image(s) can be added. Maximum is ${MAX_IMAGES}.`)
      }
      setNewImageFiles((previous) => [...previous, ...acceptedFiles])
    }
  }

  function removeExistingImage(index) {
    setProduct((previous) => ({
      ...previous,
      images: previous.images.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  function removeNewImage(index) {
    setNewImageFiles((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index)
    )
  }

  async function createUniqueSlug(name, currentId = null) {
    const baseSlug = makeSlug(name)
    const snapshot = await getDocs(collection(db, 'products'))
    const usedSlugs = new Set()

    for (const item of snapshot.docs) {
      if (item.id === currentId) continue

      const slug = (item.data().slug || '').toLowerCase()
      if (slug) usedSlugs.add(slug)
    }

    if (!usedSlugs.has(baseSlug)) return baseSlug

    let suffix = 2
    while (usedSlugs.has(`${baseSlug}-${suffix}`)) suffix += 1

    return `${baseSlug}-${suffix}`
  }

  function validateForm() {
    if (!product.name.trim()) {
      toast.error('Enter a product name.')
      return false
    }

    if (!product.categoryId) {
      toast.error('Select a category.')
      return false
    }

    const selectedCategory = categories.find(
      (item) => item.id === product.categoryId
    )

    if (!selectedCategory) {
      toast.error('The selected category no longer exists. Refresh and select a category.')
      return false
    }

    if (selectedCategory.isActive === false && product.isActive) {
      toast.error('Activate the selected category before activating this product.')
      return false
    }

    const variants = Object.entries(product.variants || {})

    if (!variants.length) {
      toast.error('Add at least one variant.')
      return false
    }

    const labels = new Set()

    for (const [variantId, variant] of variants) {
      if (!VARIANT_ID_REGEX.test(variantId)) {
        toast.error('A variant has an invalid ID.')
        return false
      }

      if (!variant.label?.trim()) {
        toast.error('Enter a label for every variant.')
        return false
      }

      const normalizedLabel = variant.label.trim().toLowerCase()
      if (labels.has(normalizedLabel)) {
        toast.error('Variant labels must be unique within a product.')
        return false
      }
      labels.add(normalizedLabel)

      const price = rupeesToPaise(variant.priceInput)
      const mrp = rupeesToPaise(variant.mrpInput)
      const stock = Number(variant.stockInput)

      if (!Number.isInteger(price) || price <= 0) {
        toast.error(`Enter a valid selling price for "${variant.label}".`)
        return false
      }

      if (!Number.isInteger(mrp) || mrp < price) {
        toast.error(`MRP must be at least the selling price for "${variant.label}".`)
        return false
      }

      if (!Number.isInteger(stock) || stock < 0) {
        toast.error(`Enter a valid non-negative whole-number stock for "${variant.label}".`)
        return false
      }
    }

    if (product.images.length + newImageFiles.length > MAX_IMAGES) {
      toast.error(`A product can have at most ${MAX_IMAGES} images.`)
      return false
    }

    return true
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!user || !isAdmin) {
      toast.error('An authorized admin account is required.')
      return
    }

    if (!validateForm()) return

    setSaving(true)

    const uploadedPaths = []
    let catalogueSaved = false
    const oldProduct = editingId
      ? products.find((item) => item.id === editingId)
      : null

    try {
      const productRef = editingId
        ? doc(db, 'products', editingId)
        : doc(collection(db, 'products'))

      const slug = await createUniqueSlug(product.name.trim(), editingId)

      const currentImages = [...product.images]
      const newImagePaths = []

      for (const file of newImageFiles) {
        const safeName = file.name
          .replace(/[^a-zA-Z0-9._-]/g, '-')
          .slice(-100)

        const imagePath =
          `products/${productRef.id}/${Date.now()}-${generateVariantId({})}-${safeName}`

        await uploadBytes(ref(storage, imagePath), file, {
          contentType: file.type,
          customMetadata: {
            uploadedBy: user.uid,
            productId: productRef.id,
          },
        })

        uploadedPaths.push(imagePath)
        newImagePaths.push(imagePath)
      }

      const images = [...currentImages, ...newImagePaths]

      const variantsToSave = {}

      for (const [variantId, variant] of Object.entries(product.variants)) {
        const savedVariant = {
          label: variant.label.trim(),
          price: rupeesToPaise(variant.priceInput),
          mrp: rupeesToPaise(variant.mrpInput),
          isActive: variant.isActive !== false,
          sortOrder: Number(variant.sortOrder) || 0,
        }

        // Stock is saved directly with the product, as agreed after removing
        // the setProductStock Cloud Function.
        savedVariant.stock = Number(variant.stockInput)

        variantsToSave[variantId] = savedVariant
      }

      const basePayload = {
        name: product.name.trim(),
        slug,
        description: product.description.trim(),
        color: product.color.trim(),
        categoryId: product.categoryId,
        images,
        isActive: Boolean(product.isActive),
        updatedAt: serverTimestamp(),
      }

      if (!editingId) {
        const sortOrder =
          products.reduce(
            (maximum, item) =>
              Math.max(maximum, Number(item.sortOrder) || 0),
            -1
          ) + 1

        await setDoc(productRef, {
          ...basePayload,
          variants: variantsToSave,
          sortOrder,
          createdAt: serverTimestamp(),
        })
        catalogueSaved = true
      } else {
        // Save catalogue and stock fields directly in Firestore.
        // This requires the deployed Firestore rules to allow admin variant edits.
        const updates = {
          ...basePayload,
        }

        const originalVariantIds = Object.keys(oldProduct?.variants || {})
        const currentVariantIds = new Set(Object.keys(product.variants))

        // Explicitly remove variants deleted in the editor; deactivation remains
        // controlled independently by the variant's active checkbox.
        for (const variantId of originalVariantIds) {
          if (!currentVariantIds.has(variantId)) {
            updates[`variants.${variantId}`] = deleteField()
          }
        }

        for (const [variantId, variant] of Object.entries(product.variants)) {
          const prefix = `variants.${variantId}`

          updates[`${prefix}.label`] = variant.label.trim()
          updates[`${prefix}.price`] = rupeesToPaise(variant.priceInput)
          updates[`${prefix}.mrp`] = rupeesToPaise(variant.mrpInput)
          updates[`${prefix}.stock`] = Number(variant.stockInput)
          updates[`${prefix}.isActive`] = variant.isActive !== false
          updates[`${prefix}.sortOrder`] = Number(variant.sortOrder) || 0
        }

        await updateDoc(productRef, updates)
        catalogueSaved = true
      }

      const retainedPaths = new Set(images)
      const oldPaths = Array.isArray(oldProduct?.images)
        ? oldProduct.images
        : []

      setFormOpen(false)
      setEditingId(null)
      setProduct({ ...EMPTY_PRODUCT })
      setNewImageFiles([])
      setCategorySearch('')
      setCategoryMenuOpen(false)

      toast.success(editingId ? 'Product updated.' : 'Product created.')

      // Delete removed images only after the Firestore save succeeds.
      for (const oldPath of oldPaths) {
        if (retainedPaths.has(oldPath)) continue

        try {
          await deleteObject(ref(storage, oldPath))
        } catch {
          // Best-effort cleanup; do not undo a successful catalogue save.
        }
      }

      await loadData({ quiet: true })
    } catch (err) {
      if (!catalogueSaved) {
        // Firestore did not save the product, so these uploaded files are not
        // referenced by a saved product and can safely be cleaned up.
        for (const uploadedPath of uploadedPaths) {
          try {
            await deleteObject(ref(storage, uploadedPath))
          } catch {
            // Preserve the original save error.
          }
        }

        toast.error(getErrorMessage(err, 'Could not save the product.'))
      } else {
        // The catalogue save succeeded. Keep uploaded files because the saved
        // product may reference them; refresh the UI and report the later error.
        console.error('Product catalogue saved, but a later operation failed:', err)
        toast.error(
          `Product ${editingId ? 'updated' : 'created'}, but a later operation failed. The saved product and its images were kept. Refresh and check the product before retrying. ${getErrorMessage(err, '')}`.trim()
        )

        try {
          await loadData({ quiet: true })
        } catch (refreshError) {
          console.error('Could not refresh products after partial save:', refreshError)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item) {
  

  if (!user || !isAdmin) {
      toast.error('An authorized admin account is required.')
      return
    }

    const nextActive = item.isActive === false

    if (nextActive) {
      const category = categories.find((entry) => entry.id === item.categoryId)

      if (!category || category.isActive === false) {
        toast.error('Activate the product category before activating this product.')
        return
      }
    }

    if (
      !window.confirm(
        `${nextActive ? 'Activate' : 'Deactivate'} "${item.name}"?`
      )
    ) {
      return
    }

    setBusyId(item.id)

    try {
      await updateDoc(doc(db, 'products', item.id), {
        isActive: nextActive,
        updatedAt: serverTimestamp(),
      })

      toast.success(nextActive ? 'Product activated.' : 'Product deactivated.')
      await loadData({ quiet: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update product status.'))
    } finally {
      setBusyId('')
    }
  }

  async function deleteProduct(item) {
    if (!user || !isAdmin) {
      toast.error('An authorized admin account is required.')
      return
    }

    const confirmed = window.confirm(
      `Permanently delete "${item.name}" and its product record? This is separate from deactivation and cannot be undone.`
    )
    if (!confirmed) return

    setBusyId(item.id)
    try {
      await deleteDoc(doc(db, 'products', item.id))

      // Product record is deleted first. Image cleanup is best-effort so a
      // Storage cleanup failure does not make the successful deletion look failed.
      for (const path of Array.isArray(item.images) ? item.images : []) {
        try {
          await deleteObject(ref(storage, path))
        } catch (imageError) {
          console.warn('Could not delete product image from Storage:', path, imageError)
        }
      }

      toast.success('Product deleted.')
      if (viewingProduct?.id === item.id) setViewingProduct(null)
      await loadData({ quiet: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete the product.'))
    } finally {
      setBusyId('')
    }
  }


  if (!user || !isAdmin) {
    return (
      <div className="rounded-xl border border-cream-dark bg-white p-6 text-brown">
        You must sign in with an authorized admin account to manage products.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <p className="text-sm text-brown-light">Loading products…</p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Products — Vatvruksha Admin</title>
      </Helmet>

      <div className="relative mb-5 flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-cream-dark bg-gradient-to-r from-white via-cream/70 to-white p-4 shadow-sm sm:mb-7 sm:p-6">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-gold">
            Catalogue
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-maroon sm:text-4xl">Products</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-brown-light">
            Manage your catalogue, variant pricing, inventory, and product visibility in one place.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-3 py-2.5 shadow-sm transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
            <Search size={16} className="text-brown-light" />
            <input
              type="search"
              placeholder="Search products…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="min-w-0 bg-transparent text-sm text-brown outline-none placeholder:text-brown-light/70 sm:w-56"
            />
          </label>

          <button
            type="button"
            onClick={() => loadData({ quiet: true })}
            disabled={refreshing}
            className="btn-ghost disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="btn-primary"
          >
            <Plus size={16} />
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => loadData()}
            className="mt-2 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="mb-5 grid min-w-0 grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-3 sm:gap-4">
        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-brown-light">Total products</p><span className="rounded-xl bg-cream p-2 text-maroon"><ImagePlus size={17} /></span></div>
          <p className="mt-1 font-serif text-3xl font-semibold text-maroon">
            {products.length}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-brown-light">Active products</p><span className="rounded-xl bg-green-50 p-2 text-green-700"><Eye size={17} /></span></div>
          <p className="mt-1 font-serif text-3xl font-semibold text-maroon">
            {products.filter((item) => item.isActive !== false).length}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium text-brown-light">Inactive products</p><span className="rounded-xl bg-amber-50 p-2 text-amber-700"><EyeOff size={17} /></span></div>
          <p className="mt-1 font-serif text-3xl font-semibold text-maroon">
            {products.filter((item) => item.isActive === false).length}
          </p>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {filteredProducts.map((item) => {
          const firstImage = (imageUrls[item.id] || []).find(Boolean)

          return (
            <article
              key={item.id}
              className="min-w-0 rounded-2xl border border-cream-dark bg-white p-3 shadow-sm transition hover:border-gold/60 sm:p-4"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cream-dark bg-cream sm:h-20 sm:w-20">
                  {firstImage ? (
                    <img
                      src={firstImage}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <ImagePlus size={21} className="text-brown-light" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h2 className="break-words text-sm font-semibold text-brown sm:text-base">
                      {item.name}
                    </h2>
                    <span
                      className={`badge status-badge shrink-0 ${
                        item.isActive === false
                          ? 'status-cancelled'
                          : 'status-confirmed'
                      }`}
                    >
                      {item.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-xs text-brown-light">
                    {categoryNames[item.categoryId] || 'Unassigned'}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-cream-dark pt-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-brown-light">Price</p>
                  <p className="mt-1 break-words text-xs font-semibold text-brown sm:text-sm">
                    {getProductPriceRange(item)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-brown-light">Stock</p>
                  <p className="mt-1 text-sm font-semibold text-brown">
                    {getTotalStock(item)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-brown-light">Variants</p>
                  <p className="mt-1 text-sm font-semibold text-brown">
                    {getVariantCount(item)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cream-dark pt-3">
                <button
                  type="button"
                  onClick={() => setViewingProduct(item)}
                  disabled={Boolean(busyId)}
                  className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-cream-dark bg-white px-3 py-2 text-xs font-semibold text-maroon shadow-sm transition hover:border-gold hover:bg-cream disabled:opacity-50"
                  title="View product details"
                  aria-label={`View ${item.name} details`}
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  disabled={Boolean(busyId)}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-cream-dark p-2 text-brown transition hover:bg-cream hover:text-maroon disabled:opacity-50"
                  title="Edit product"
                  aria-label={`Edit ${item.name}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  disabled={Boolean(busyId)}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-cream-dark p-2 text-brown transition hover:bg-cream hover:text-maroon disabled:opacity-50"
                  title={item.isActive === false ? 'Activate' : 'Deactivate'}
                  aria-label={`${item.isActive === false ? 'Activate' : 'Deactivate'} ${item.name}`}
                >
                  {item.isActive === false ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => deleteProduct(item)}
                  disabled={Boolean(busyId)}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-red-100 p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                  title="Delete product"
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          )
        })}

        {filteredProducts.length === 0 && (
          <div className="rounded-2xl border border-cream-dark bg-white px-4 py-10 text-center text-sm text-brown-light">
            {searchQuery
              ? 'No products match your search.'
              : 'No products yet. Select “Add Product” to create one.'}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-sm lg:block">
        <div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead>
              <tr>
                <th>Image</th>
                <th>Product</th>
                <th>Category</th>
                <th>Price range</th>
                <th>Stock</th>
                <th>Variants</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredProducts.map((item) => {
                const firstImage = (imageUrls[item.id] || []).find(Boolean)

                return (
                  <tr
                    key={item.id}
                    className="border-b border-cream-dark/80 transition-colors duration-150 hover:bg-cream/60"
                  >
                    <td>
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-cream-dark bg-cream">
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={item.name}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlus size={21} className="text-brown-light" />
                        )}
                      </div>
                    </td>

                    <td className="max-w-56">
                      <p className="font-semibold text-brown">{item.name}</p>
                    </td>

                    <td className="text-brown-light">
                      {categoryNames[item.categoryId] || 'Unassigned'}
                    </td>

                    <td className="whitespace-nowrap text-brown-light">
                      {getProductPriceRange(item)}
                    </td>

                    <td className="text-brown-light">{getTotalStock(item)}</td>

                    <td className="text-brown-light">
                      {getVariantCount(item)}
                    </td>

                    <td>
                      <span
                        className={`badge status-badge ${
                          item.isActive === false
                            ? 'status-cancelled'
                            : 'status-confirmed'
                        }`}
                      >
                        {item.isActive === false ? 'Inactive' : 'Active'}
                      </span>
                    </td>

                    <td>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingProduct(item)}
                          disabled={Boolean(busyId)}
                          className="rounded-lg border border-cream-dark bg-white px-3 py-2 text-xs font-semibold text-maroon shadow-sm transition hover:border-gold hover:bg-cream disabled:opacity-50"
                          title="View product details"
                          aria-label={`View ${item.name} details`}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          disabled={Boolean(busyId)}
                          className="rounded-lg border border-transparent p-2 text-brown transition hover:border-cream-dark hover:bg-cream hover:text-maroon disabled:opacity-50"
                          title="Edit product"
                          aria-label={`Edit ${item.name}`}
                        >
                          <Edit2 size={16} />
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleActive(item)}
                          disabled={Boolean(busyId)}
                          className="rounded-lg border border-transparent p-2 text-brown transition hover:border-cream-dark hover:bg-cream hover:text-maroon disabled:opacity-50"
                          title={item.isActive === false ? 'Activate' : 'Deactivate'}
                          aria-label={`${
                            item.isActive === false ? 'Activate' : 'Deactivate'
                          } ${item.name}`}
                        >
                          {item.isActive === false ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteProduct(item)}
                          disabled={Boolean(busyId)}
                          className="rounded-lg border border-transparent p-2 text-red-600 transition hover:border-red-100 hover:bg-red-50 disabled:opacity-50"
                          title="Delete product"
                          aria-label={`Delete ${item.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredProducts.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center text-brown-light"
                  >
                    {searchQuery
                      ? 'No products match your search.'
                      : 'No products yet. Select “Add Product” to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown/55 p-4 backdrop-blur-sm sm:p-6">
          <div className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gold/40 bg-white p-4 shadow-[0_24px_80px_rgba(54,25,18,0.28)] sm:rounded-3xl sm:p-7">
            <div className="-mx-5 -mt-5 mb-6 flex items-start justify-between gap-4 border-b border-cream-dark bg-gradient-to-r from-cream via-white to-white px-5 py-5 sm:-mx-7 sm:-mt-7 sm:px-7 sm:py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  Catalogue
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-maroon sm:text-3xl">Product Details</h2>
                <p className="mt-2 text-sm text-brown-light">A complete read-only overview of this catalogue item.</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingProduct(null)}
                className="rounded-lg p-2 text-brown hover:bg-cream hover:text-maroon"
                aria-label="Close product details"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brown-light">Product name</p>
                  <p className="mt-1.5 text-lg font-semibold text-maroon">{viewingProduct.name || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brown-light">Category</p>
                  <p className="mt-1 text-brown">{categoryNames[viewingProduct.categoryId] || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brown-light">Color</p>
                  <p className="mt-1 text-brown">{viewingProduct.color || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brown-light">Status</p>
                  <p className="mt-1 text-brown">{viewingProduct.isActive === false ? 'Inactive' : 'Active'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brown-light">Price range</p>
                  <p className="mt-1 text-brown">{getProductPriceRange(viewingProduct)}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-cream-dark bg-cream/35 p-4 sm:p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brown-light">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-brown">{viewingProduct.description || 'No description provided.'}</p>
              </div>

              <section className="rounded-2xl border border-cream-dark bg-cream/35 p-4 sm:p-5">
                <h3 className="mb-3 font-serif text-lg font-semibold text-maroon">Product images</h3>
                {(imageUrls[viewingProduct.id] || []).filter(Boolean).length ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {(imageUrls[viewingProduct.id] || []).filter(Boolean).map((url, index) => (
                      <div key={`${url}-${index}`} className="overflow-hidden rounded-xl border border-cream-dark bg-cream">
                        <img src={url} alt={`${viewingProduct.name} image ${index + 1}`} className="h-32 w-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-brown-light">No images available.</p>
                )}
              </section>

              <section className="rounded-2xl border border-cream-dark bg-white p-4 sm:p-5">
                <h3 className="mb-3 font-serif text-lg font-semibold text-maroon">Variants</h3>
                <div className="space-y-3">
                  {Object.entries(viewingProduct.variants || {}).map(([variantId, variant]) => (
                    <div key={variantId} className="rounded-2xl border border-cream-dark bg-gradient-to-br from-cream/70 to-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-brown">{variant.label || 'Unnamed variant'}</p>
                        </div>
                        <span className={`badge status-badge ${variant.isActive === false ? 'status-cancelled' : 'status-confirmed'}`}>
                          {variant.isActive === false ? 'Inactive' : 'Active'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <p className="text-xs text-brown-light">Selling price</p>
                          <p className="mt-1 text-sm font-medium text-brown">{formatINR(Number(variant.price) || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-brown-light">MRP</p>
                          <p className="mt-1 text-sm font-medium text-brown">{formatINR(Number(variant.mrp) || 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-brown-light">Stock</p>
                          <p className="mt-1 text-sm font-medium text-brown">{Math.max(0, Number(variant.stock) || 0)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="-mx-5 -mb-5 mt-7 flex flex-col-reverse gap-2 border-t border-cream-dark bg-cream/35 px-5 py-4 sm:-mx-7 sm:-mb-7 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" onClick={() => setViewingProduct(null)} className="btn-ghost justify-center">
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const selected = viewingProduct
                  setViewingProduct(null)
                  openEdit(selected)
                }}
                className="btn-primary justify-center"
              >
                <Edit2 size={16} />
                Edit Product
              </button>
            </div>
          </div>
        </div>
      )}

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown/55 p-4 backdrop-blur-sm sm:p-6">
          <div className="relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gold/40 bg-white p-4 shadow-[0_24px_80px_rgba(54,25,18,0.28)] sm:rounded-3xl sm:p-7">
            <div className="-mx-5 -mt-5 mb-6 flex items-center justify-between gap-4 border-b border-cream-dark bg-gradient-to-r from-cream via-white to-white px-5 py-5 sm:-mx-7 sm:-mt-7 sm:px-7 sm:py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  Catalogue
                </p>
                <h2 className="mt-1 font-serif text-2xl font-semibold text-maroon sm:text-3xl">
                  {editingId ? 'Edit Product' : 'Add Product'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg border border-transparent p-2 text-brown transition hover:border-cream-dark hover:bg-cream hover:text-maroon disabled:opacity-50"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="product-name"
                    className="mb-1 block text-sm font-medium text-brown"
                  >
                    Product name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="product-name"
                    name="name"
                    value={product.name}
                    onChange={handleProductChange}
                    maxLength={150}
                    required
                    className="w-full rounded-xl border border-cream-dark bg-cream/70 px-3 py-2.5 text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                    placeholder="Product name"
                  />
                </div>

                <div>
                  <label
                    htmlFor="product-category"
                    className="mb-1 block text-sm font-medium text-brown"
                  >
                    Category <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="product-category"
                      type="text"
                      value={categoryMenuOpen ? categorySearch : (categoryNames[product.categoryId] || categorySearch)}
                      onChange={(event) => {
                        setCategorySearch(event.target.value)
                        setCategoryMenuOpen(true)
                        if (!event.target.value) setProduct((previous) => ({ ...previous, categoryId: '' }))
                      }}
                      onFocus={() => {
                        setCategorySearch('')
                        setCategoryMenuOpen(true)
                      }}
                      onBlur={() => setTimeout(() => setCategoryMenuOpen(false), 150)}
                      autoComplete="off"
                      required={!product.categoryId}
                      placeholder="Search active categories…"
                      className="w-full rounded-xl border border-cream-dark bg-cream/70 px-3 py-2.5 text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                      aria-expanded={categoryMenuOpen}
                      aria-controls="active-category-options"
                    />
                    {categoryMenuOpen && (
                      <div id="active-category-options" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-cream-dark bg-white p-1 shadow-lg">
                        {categories
                          .filter((item) => item.isActive !== false)
                          .filter((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase()))
                          .map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => {
                                setProduct((previous) => ({ ...previous, categoryId: item.id }))
                                setCategorySearch(item.name)
                                setCategoryMenuOpen(false)
                              }}
                              className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-maroon-50 ${product.categoryId === item.id ? 'bg-maroon-50 font-semibold text-maroon' : 'text-brown'}`}
                            >
                              {item.name}
                            </button>
                          ))}
                        {categories.filter((item) => item.isActive !== false).filter((item) => item.name.toLowerCase().includes(categorySearch.trim().toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-sm text-brown-light">No active categories found.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="product-color"
                    className="mb-1 block text-sm font-medium text-brown"
                  >
                    Color
                  </label>
                  <input
                    id="product-color"
                    name="color"
                    value={product.color}
                    onChange={handleProductChange}
                    maxLength={100}
                    className="w-full rounded-xl border border-cream-dark bg-cream/70 px-3 py-2.5 text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                    placeholder="Optional"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-cream-dark px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-brown">
                      Product active
                    </p>
                    <p className="text-xs text-brown-light">
                      Inactive products are hidden from customers.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(product.isActive)}
                    onChange={(event) =>
                      setProduct((previous) => ({
                        ...previous,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-maroon"
                    aria-label="Product active"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="product-description"
                  className="mb-1 block text-sm font-medium text-brown"
                >
                  Description
                </label>
                <textarea
                  id="product-description"
                  name="description"
                  value={product.description}
                  onChange={handleProductChange}
                  rows={4}
                  maxLength={5000}
                  className="w-full resize-y rounded-xl border border-cream-dark bg-cream/70 px-3 py-2.5 text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                  placeholder="Describe the product."
                />
              </div>

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-brown">
                    Product images
                  </h3>
                  <p className="mt-1 text-xs text-brown-light">
                    Select multiple JPG, PNG, or WebP images. Maximum 5 MB per image.
                  </p>
                </div>

                <label
                  htmlFor="product-images"
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-cream-darker bg-cream/60 px-4 py-5 text-sm font-medium text-maroon hover:bg-maroon-50"
                >
                  <ImagePlus size={18} />
                  Add images
                </label>
                <input
                  id="product-images"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelection}
                  className="sr-only"
                />

                {(product.images.length > 0 || newImageFiles.length > 0) && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {product.images.map((path, index) => (
                      <div
                        key={`${path}-${index}`}
                        className="overflow-hidden rounded-xl border border-cream-dark bg-white"
                      >
                        <div className="flex h-28 items-center justify-center bg-cream">
                          {imageUrls[editingId]?.[Math.max(0, (products.find((item) => item.id === editingId)?.images || []).indexOf(path))] ? (
                            <img
                              src={imageUrls[editingId][Math.max(0, (products.find((item) => item.id === editingId)?.images || []).indexOf(path))]}
                              alt={`Product image ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImagePlus size={24} className="text-brown-light" />
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate text-xs text-brown-light">
                            Image {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeExistingImage(index)}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                            aria-label={`Remove image ${index + 1}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {newImageFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="overflow-hidden rounded-xl border border-cream-dark bg-white"
                      >
                        <div className="h-28 bg-cream">
                          <img
                            src={imagePreviews[index]}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="truncate text-xs text-brown-light">
                            {file.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeNewImage(index)}
                            className="rounded p-1 text-red-600 hover:bg-red-50"
                            aria-label={`Remove ${file.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-cream-dark bg-gradient-to-br from-cream/70 to-white p-4 shadow-sm">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-serif text-lg font-semibold text-maroon">Variants</h3>
                    <p className="mt-1 text-xs text-brown-light">
                      Enter prices in rupees and manage each variant’s stock here.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={addVariant}
                    className="btn-ghost"
                  >
                    <Plus size={15} />
                    Add variant
                  </button>
                </div>

                <div className="space-y-4">
                  {Object.entries(product.variants).map(([variantId, variant]) => (
                    <div
                      key={variantId}
                      className="rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition hover:border-gold/50"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-brown">
                            {variant.label || 'New variant'}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeVariant(variantId)}
                          className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                          title="Delete variant"
                          aria-label={`Delete ${variant.label || "Unnamed variant"}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-brown">
                            Variant label
                          </label>
                          <input
                            value={variant.label}
                            onChange={(event) =>
                              setVariantField(variantId, 'label', event.target.value)
                            }
                            required
                            maxLength={100}
                            className="w-full rounded-lg border border-cream-dark bg-cream/70 px-3 py-2.5 text-sm text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                            placeholder="e.g. Small"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-brown">
                            Selling price (₹)
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={variant.priceInput}
                            onChange={(event) =>
                              setVariantField(variantId, 'priceInput', event.target.value)
                            }
                            required
                            className="w-full rounded-lg border border-cream-dark bg-cream/70 px-3 py-2.5 text-sm text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-brown">
                            MRP (₹)
                          </label>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={variant.mrpInput}
                            onChange={(event) =>
                              setVariantField(variantId, 'mrpInput', event.target.value)
                            }
                            required
                            className="w-full rounded-lg border border-cream-dark bg-cream/70 px-3 py-2.5 text-sm text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium text-brown">
                            Current stock
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={variant.stockInput}
                            onChange={(event) => setVariantField(variantId, 'stockInput', event.target.value)}
                            required
                            className="w-full rounded-lg border border-cream-dark bg-cream/70 px-3 py-2.5 text-sm text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                            aria-label={`Stock for ${variant.label || 'variant'}`}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label className="flex items-center gap-2 text-sm text-brown">
                          <input
                            type="checkbox"
                            checked={variant.isActive !== false}
                            onChange={(event) =>
                              setVariantField(
                                variantId,
                                'isActive',
                                event.target.checked
                              )
                            }
                            className="h-4 w-4 accent-maroon"
                          />
                          Variant active
                        </label>

                        <span className="text-xs text-brown-light">
                          {variant._isNew
                            ? 'New variant'
                            : 'Existing variant'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex flex-col-reverse gap-2 border-t border-cream-dark pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className="btn-ghost justify-center disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary justify-center disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? 'Saving…'
                    : editingId
                      ? 'Save Changes'
                      : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
