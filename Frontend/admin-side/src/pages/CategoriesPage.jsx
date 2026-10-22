
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  Plus,
  Trash2,
  Edit2,
  EyeOff,
  Eye,
  X,
  Search,
  RefreshCw,
  ImagePlus,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { useAdminAuth } from '../context/AuthContext'

const EMPTY_CATEGORY = {
  name: '',
  isActive: true,
  imagePath: '',
}

const MAX_BATCH_PRODUCTS = 499
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function makeSlug(value = '') {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'category'
  )
}

function sortCategories(items) {
  return [...items].sort((a, b) => {
    const difference =
      (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)

    return difference || (a.name || '').localeCompare(b.name || '')
  })
}

function getErrorMessage(error, fallback) {
  if (error?.code === 'permission-denied') {
    return 'Permission denied. Check the admin account and Firestore security rules.'
  }

  return error?.message || fallback
}

export default function CategoriesPage() {
  const { user, isAdmin } = useAdminAuth()

  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [category, setCategory] = useState({ ...EMPTY_CATEGORY })
  const [categoryImageUrls, setCategoryImageUrls] = useState({})
  const [imageFile, setImageFile] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState('')
  const imageFilePreview = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : ''),
    [imageFile]
  )

  useEffect(() => {
    return () => {
      if (imageFilePreview) URL.revokeObjectURL(imageFilePreview)
    }
  }, [imageFilePreview])

  const loadData = useCallback(
    async ({ quiet = false } = {}) => {
      if (!user || !isAdmin) {
        setCategories([])
        setProducts([])
        setLoading(false)
        setRefreshing(false)
        return
      }

      if (quiet) setRefreshing(true)
      else setLoading(true)

      setError('')

      try {
        const [categorySnapshot, productSnapshot] = await Promise.all([
          getDocs(collection(db, 'categories')),
          getDocs(collection(db, 'products')),
        ])

        const categoryItems = categorySnapshot.docs.map((snapshot) => ({
          id: snapshot.id,
          ...snapshot.data(),
        }))

        const productItems = productSnapshot.docs.map((snapshot) => ({
          id: snapshot.id,
          ...snapshot.data(),
        }))

        setCategories(sortCategories(categoryItems))
        setProducts(productItems)

        const imageEntries = await Promise.all(
          categoryItems.map(async (item) => {
            if (!item.imagePath) return [item.id, '']
            try {
              return [item.id, await getDownloadURL(ref(storage, item.imagePath))]
            } catch {
              return [item.id, '']
            }
          })
        )
        setCategoryImageUrls(Object.fromEntries(imageEntries))

      } catch (err) {
        const message = getErrorMessage(
          err,
          'Could not load categories and products.'
        )
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [user, isAdmin]
  )

  useEffect(() => {
    loadData()
  }, [loadData])


  const productsByCategory = useMemo(() => {
    const counts = {}

    for (const product of products) {
      if (!product.categoryId) continue
      counts[product.categoryId] = (counts[product.categoryId] || 0) + 1
    }

    return counts
  }, [products])

  const filteredCategories = useMemo(() => {
    const search = searchQuery.trim().toLocaleLowerCase()

    if (!search) return categories

    return categories.filter(
      (item) =>
        (item.name || '').toLocaleLowerCase().includes(search) ||
        (item.slug || '').toLocaleLowerCase().includes(search)
    )
  }, [categories, searchQuery])

  function openCreate() {
    setEditingId(null)
    setCategory({ ...EMPTY_CATEGORY, isActive: true })
    setImageFile(null)
    setRemoveImage(false)
    setFormOpen(true)
  }

  function openEdit(item) {
    setEditingId(item.id)
    setCategory({
      name: item.name || '',
      isActive: item.isActive !== false,
      imagePath: item.imagePath || '',
    })
    setImageFile(null)
    setRemoveImage(false)
    setFormOpen(true)
  }

  function closeForm() {
    if (saving) return

    setFormOpen(false)
    setEditingId(null)
    setCategory({ ...EMPTY_CATEGORY })
    setImageFile(null)
    setRemoveImage(false)
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0] || null
    event.target.value = ''
    if (!file) return
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Choose a JPG, PNG, or WebP image.')
      return
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error('Category images must be 5 MB or smaller.')
      return
    }
    setImageFile(file)
    setRemoveImage(false)
  }

  function handleTextChange(event) {
    const { name, value } = event.target
    setCategory((previous) => ({ ...previous, [name]: value }))
  }


  async function createUniqueSlug(name, currentId = null) {
    const baseSlug = makeSlug(name)
    const latestSnapshot = await getDocs(collection(db, 'categories'))
    const usedSlugs = new Set()

    for (const snapshot of latestSnapshot.docs) {
      if (snapshot.id === currentId) continue

      const existingSlug = (snapshot.data().slug || '').toLowerCase()
      if (existingSlug) usedSlugs.add(existingSlug)
    }

    if (!usedSlugs.has(baseSlug)) return baseSlug

    let suffix = 2
    while (usedSlugs.has(`${baseSlug}-${suffix}`)) suffix += 1

    return `${baseSlug}-${suffix}`
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!user || !isAdmin) {
      toast.error('An authorized admin account is required.')
      return
    }

    const trimmedName = category.name.trim().replace(/\s+/g, ' ')

    if (!trimmedName) {
      toast.error('Enter a category name.')
      return
    }

    setSaving(true)
    const uploadedPaths = []
    let categorySaved = false
    const existingImagePath = categories.find((item) => item.id === editingId)?.imagePath || ''

    try {
      // Fetch the latest category records before validating the name.
      const latestCategories = await getDocs(collection(db, 'categories'))

      const duplicate = latestCategories.docs.some((snapshot) => {
        if (snapshot.id === editingId) return false

        return normalizeName(snapshot.data().name) === normalizeName(trimmedName)
      })

      if (duplicate) {
        toast.error('A category with this name already exists.')
        return
      }

      const categoryRef = editingId
        ? doc(db, 'categories', editingId)
        : doc(collection(db, 'categories'))

      const existingCategory = editingId
        ? categories.find((item) => item.id === editingId)
        : null


      const slug = await createUniqueSlug(trimmedName, editingId)


      // New categories are always active. The creation form has no status control.
      const nextIsActive = editingId
        ? Boolean(category.isActive)
        : true

      // Automatically assign sortOrder for new categories.
      const nextSortOrder = editingId
        ? Number(existingCategory?.sortOrder) || 0
        : categories.reduce(
            (maximum, item) =>
              Math.max(maximum, Number(item.sortOrder) || 0),
            -1
          ) + 1

      let nextImagePath = category.imagePath || ''
      if (removeImage) {
        nextImagePath = ''
      } else if (imageFile) {
        const safeName = imageFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-100)
        nextImagePath = `categories/${categoryRef.id}/${Date.now()}-${safeName}`
        await uploadBytes(ref(storage, nextImagePath), imageFile, {
          contentType: imageFile.type,
          customMetadata: { uploadedBy: user.uid, categoryId: categoryRef.id },
        })
        uploadedPaths.push(nextImagePath)
      }

      const payload = {
        name: trimmedName,
        slug,
        isActive: nextIsActive,
        sortOrder: nextSortOrder,
        updatedAt: serverTimestamp(),
      }
      if (nextImagePath) payload.imagePath = nextImagePath
      else if (removeImage) payload.imagePath = ''

      if (!editingId) {
        payload.createdAt = serverTimestamp()
      }

      // If status changes during editing, update the category and all its
      // linked products together in one atomic Firestore batch.
      const previousIsActive = existingCategory
        ? existingCategory.isActive !== false
        : true

      const statusChanged =
        Boolean(editingId) && previousIsActive !== nextIsActive

      if (statusChanged) {
        const linkedProducts = products.filter(
          (product) => product.categoryId === editingId
        )

        if (linkedProducts.length > MAX_BATCH_PRODUCTS) {
          throw new Error(
            `This category has ${linkedProducts.length} linked products. A single atomic batch supports at most ${MAX_BATCH_PRODUCTS} linked products plus the category. No Firestore changes were made.`
          )
        }

        const batch = writeBatch(db)
        batch.set(categoryRef, payload, { merge: true })

        for (const product of linkedProducts) {
          batch.update(doc(db, 'products', product.id), {
            isActive: nextIsActive,
            updatedAt: serverTimestamp(),
          })
        }

        await batch.commit()
      } else {
        await setDoc(categoryRef, payload, { merge: true })
      }
      categorySaved = true

      if (existingImagePath && (removeImage || (imageFile && nextImagePath !== existingImagePath))) {
        try { await deleteObject(ref(storage, existingImagePath)) } catch (cleanupError) { console.warn('Could not remove replaced category image:', cleanupError) }
      }

      setFormOpen(false)
      setEditingId(null)
      setCategory({ ...EMPTY_CATEGORY })
      setImageFile(null)
      setRemoveImage(false)
  
      toast.success(
        editingId ? 'Category updated.' : 'Category created and activated.'
      )


      await loadData({ quiet: true })
    } catch (err) {
      if (!categorySaved) {
        await Promise.all(uploadedPaths.map(async (path) => {
          try { await deleteObject(ref(storage, path)) } catch (cleanupError) { console.warn('Could not clean up uploaded category image:', cleanupError) }
        }))
      }
      toast.error(getErrorMessage(err, 'Could not save the category.'))
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
    const linkedProducts = products.filter(
      (product) => product.categoryId === item.id
    )

    const action = nextActive ? 'activate' : 'deactivate'
    const message = linkedProducts.length
      ? `Are you sure you want to ${action} "${item.name}" and ${action} all ${linkedProducts.length} linked product(s)?`
      : `Are you sure you want to ${action} "${item.name}"?`

    if (!window.confirm(message)) return

    if (linkedProducts.length > MAX_BATCH_PRODUCTS) {
      toast.error(
        `This category has too many linked products for one atomic batch. No changes were made.`
      )
      return
    }

    setBusyId(item.id)

    try {
      const batch = writeBatch(db)

      batch.update(doc(db, 'categories', item.id), {
        isActive: nextActive,
        updatedAt: serverTimestamp(),
      })

      for (const product of linkedProducts) {
        batch.update(doc(db, 'products', product.id), {
          isActive: nextActive,
          updatedAt: serverTimestamp(),
        })
      }

      await batch.commit()

      toast.success(
        nextActive
          ? 'Category and linked products activated.'
          : 'Category and linked products deactivated.'
      )

      await loadData({ quiet: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not change category status.'))
    } finally {
      setBusyId('')
    }
  }

  async function handleDelete(item) {
    if (!user || !isAdmin) {
      toast.error('An authorized admin account is required.')
      return
    }

    setBusyId(item.id)

    try {
      // Check Firestore directly, rather than relying only on the dashboard count.
      const linkedSnapshot = await getDocs(
        query(
          collection(db, 'products'),
          where('categoryId', '==', item.id)
        )
      )

      if (!linkedSnapshot.empty) {
        toast.error(
          `Cannot delete "${item.name}": ${linkedSnapshot.size} product(s) still reference this category. Reassign those products first. No products were deleted.`
        )
        return
      }

      if (
        !window.confirm(
          `Permanently delete category "${item.name}"? This cannot be undone.`
        )
      ) {
        return
      }

      await deleteDoc(doc(db, 'categories', item.id))


      toast.success('Category deleted.')
      await loadData({ quiet: true })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete the category.'))
    } finally {
      setBusyId('')
    }
  }

  if (!user || !isAdmin) {
    return (
      <div className="rounded-xl border border-cream-dark bg-white p-6 text-brown">
        You must sign in with an authorized admin account to manage categories.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <p className="text-sm text-brown-light">Loading categories…</p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Categories — Vatvruksha Admin</title>
      </Helmet>

      <div className="relative mb-5 flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-cream-dark bg-gradient-to-r from-white via-cream/70 to-white p-4 shadow-sm sm:mb-7 sm:p-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">
            Catalogue
          </p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Categories</h1>
          <p className="mt-1 text-sm text-brown-light">
            Manage category details and visibility.
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
          <label className="flex items-center gap-2 rounded-xl border border-cream-dark bg-white px-3 py-2.5 shadow-sm transition focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
            <Search size={16} className="text-brown-light" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search categories…"
              className="min-w-0 bg-transparent text-sm text-brown outline-none placeholder:text-brown-light/70 sm:w-52"
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
            Add Category
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Could not load category data</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => loadData()}
            className="mt-3 underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="mb-5 grid min-w-0 grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-3 sm:gap-4">
        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <p className="text-sm text-brown-light">Total categories</p>
          <p className="mt-1 text-2xl font-semibold text-brown">
            {categories.length}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <p className="text-sm text-brown-light">Active categories</p>
          <p className="mt-1 text-2xl font-semibold text-brown">
            {categories.filter((item) => item.isActive !== false).length}
          </p>
        </div>

        <div className="group min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
          <p className="text-sm text-brown-light">Product links</p>
          <p className="mt-1 text-2xl font-semibold text-brown">
            {Object.values(productsByCategory).reduce((sum, count) => sum + count, 0)}
          </p>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {filteredCategories.map((item) => (
          <article
            key={item.id}
            className="min-w-0 rounded-2xl border border-cream-dark bg-white p-3 shadow-sm transition hover:border-gold/60 sm:p-4"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              {categoryImageUrls[item.id] && (
                <img src={categoryImageUrls[item.id]} alt={`${item.name || 'Category'} category`} className="h-16 w-16 shrink-0 rounded-lg border border-cream-dark object-cover sm:h-20 sm:w-20" />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-sm font-semibold text-brown sm:text-base">
                  {item.name || 'Unnamed category'}
                </h2>
              </div>
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

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-cream-dark pt-3">
              <div>
                <p className="text-xs text-brown-light">Linked products</p>
                <p className="mt-1 text-sm font-semibold text-brown">
                  {productsByCategory[item.id] || 0}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  disabled={Boolean(busyId)}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-cream-dark p-2 text-brown transition hover:bg-cream hover:text-maroon disabled:opacity-50"
                  title="Edit category"
                  aria-label={`Edit ${item.name}`}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  disabled={Boolean(busyId)}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-cream-dark p-2 text-brown transition hover:bg-cream hover:text-maroon disabled:opacity-50"
                  title={item.isActive === false ? 'Activate category and products' : 'Deactivate category and products'}
                  aria-label={`${item.isActive === false ? 'Activate' : 'Deactivate'} ${item.name}`}
                >
                  {item.isActive === false ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={Boolean(busyId) || (productsByCategory[item.id] || 0) > 0}
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-red-100 p-2 text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  title={(productsByCategory[item.id] || 0) > 0 ? 'Reassign linked products before deleting' : 'Delete category'}
                  aria-label={`Delete ${item.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}

        {filteredCategories.length === 0 && (
          <div className="rounded-2xl border border-cream-dark bg-white px-4 py-10 text-center text-sm text-brown-light">
            {searchQuery
              ? 'No categories match your search.'
              : 'No categories yet. Select “Add Category” to create one.'}
          </div>
        )}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-sm transition-shadow duration-200 hover:shadow-md lg:block">
        <div className="overflow-x-auto">
          <table className="table min-w-[760px]">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Category</th>
                <th>Products</th>
                <th>Status</th>
                <th className="w-36">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCategories.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-cream-dark transition-colors duration-200 hover:bg-cream/70"
                >
                  <td>
                    {categoryImageUrls[item.id] ? <img src={categoryImageUrls[item.id]} alt={`${item.name || 'Category'} category`} className="h-12 w-12 rounded-lg border border-cream-dark object-cover" /> : <span className="text-xs text-brown-light">—</span>}
                  </td>
                  <td className="max-w-64">
                    <p className="font-semibold text-brown">
                      {item.name || 'Unnamed category'}
                    </p>
                  </td>

                  <td className="text-brown-light">
                    {productsByCategory[item.id] || 0}
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
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        disabled={Boolean(busyId)}
                        className="rounded-lg p-2 text-brown hover:bg-cream hover:text-maroon disabled:opacity-50"
                        title="Edit category"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Edit2 size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleActive(item)}
                        disabled={Boolean(busyId)}
                        className="rounded-lg p-2 text-brown hover:bg-cream hover:text-maroon disabled:opacity-50"
                        title={
                          item.isActive === false
                            ? 'Activate category and products'
                            : 'Deactivate category and products'
                        }
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
                        onClick={() => handleDelete(item)}
                        disabled={
                          Boolean(busyId) ||
                          (productsByCategory[item.id] || 0) > 0
                        }
                        className="rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                        title={
                          (productsByCategory[item.id] || 0) > 0
                            ? 'Reassign linked products before deleting'
                            : 'Delete category'
                        }
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCategories.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-brown-light"
                  >
                    {searchQuery
                      ? 'No categories match your search.'
                      : 'No categories yet. Select “Add Category” to create one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gold/40 bg-white p-4 shadow-[0_24px_80px_rgba(54,25,18,0.28)] sm:rounded-3xl sm:p-7">
            <div className="-mx-5 -mt-5 mb-6 flex items-center justify-between gap-4 border-b border-cream-dark bg-gradient-to-r from-cream via-white to-white px-5 py-5 sm:-mx-7 sm:-mt-7 sm:px-7 sm:py-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  Catalogue
                </p>
                <h2 className="mt-1 font-serif text-2xl text-brown">
                  {editingId ? 'Edit Category' : 'Add Category'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="rounded-lg p-2 text-brown hover:bg-cream hover:text-maroon disabled:opacity-50"
                aria-label="Close form"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="category-name"
                  className="mb-1 block text-sm font-medium text-brown"
                >
                  Category name <span className="text-red-600">*</span>
                </label>
                <input
                  id="category-name"
                  name="name"
                  value={category.name}
                  onChange={handleTextChange}
                  maxLength={100}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-cream-dark bg-cream px-3 py-2.5 text-brown outline-none transition focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
                  placeholder="e.g. Pooja Essentials"
                />
                <p className="mt-1 text-xs text-brown-light">
                  Category names are checked for duplicates regardless of
                  capitalization.
                </p>
              </div>




              <div className="rounded-xl border border-cream-dark p-3 sm:p-4">
                <label htmlFor="category-image" className="mb-2 block text-sm font-medium text-brown">
                  Category photo <span className="font-normal text-brown-light">(optional)</span>
                </label>
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl border border-cream-dark bg-cream/60 sm:h-28 sm:w-36">
                    {imageFile ? (
                      <img src={imageFilePreview} alt="Selected category preview" className="h-full w-full object-cover" />
                    ) : !removeImage && category.imagePath && categoryImageUrls[editingId] ? (
                      <img src={categoryImageUrls[editingId]} alt={`${category.name || 'Category'} preview`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-brown-light"><ImagePlus size={24} /><span className="text-xs">No photo selected</span></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <input id="category-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="block w-full min-w-0 text-sm text-brown file:mr-3 file:rounded-lg file:border-0 file:bg-cream file:px-3 file:py-2 file:font-medium file:text-brown hover:file:bg-cream-dark" />
                    <p className="text-xs text-brown-light">JPG, PNG, or WebP; maximum 5 MB. This image can be used on the customer dashboard.</p>
                    {(imageFile || (category.imagePath && !removeImage)) && (
                      <button type="button" onClick={() => { setImageFile(null); setRemoveImage(true) }} className="text-sm font-medium text-red-700 underline underline-offset-2">
                        Remove photo
                      </button>
                    )}
                    {removeImage && <p className="text-xs text-red-700">Photo will be removed when you save.</p>}
                  </div>
                </div>
              </div>

              {editingId ? (
                <div className="flex items-center justify-between rounded-xl border border-cream-dark px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-brown">
                      Category active
                    </p>
                    <p className="text-xs text-brown-light">
                      Changing this status also changes the status of all
                      products linked to this category.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={Boolean(category.isActive)}
                    onChange={(event) =>
                      setCategory((previous) => ({
                        ...previous,
                        isActive: event.target.checked,
                      }))
                    }
                    className="h-5 w-5 accent-maroon"
                    aria-label="Category active"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-cream-dark bg-cream/60 px-4 py-3">
                  <p className="text-sm font-medium text-brown">
                    Status: Active
                  </p>
                  <p className="mt-1 text-xs text-brown-light">
                    New categories are automatically active when created.
                  </p>
                </div>
              )}

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
                      : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
