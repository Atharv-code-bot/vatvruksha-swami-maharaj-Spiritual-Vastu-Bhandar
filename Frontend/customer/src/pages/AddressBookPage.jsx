import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import {
  fetchAddresses,
  saveAddress,
  deleteAddress,
} from '../functions/addresses'

const initialForm = {
  fullName: '',
  mobile: '',
  addressLine1: '',
  addressLine2: '',
  landmark: '',
  city: '',
  state: '',
  pincode: '',
  isDefault: false,
}

export default function AddressBookPage() {
  const { user } = useAuth()
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [formMode, setFormMode] = useState(false) // false = list, true = add/edit form
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(initialForm)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const data = await fetchAddresses(user.uid)
        setAddresses(data)
      } catch (err) {
        setLoadError(err?.message || 'Could not load addresses. Check your connection and permissions, then try again.')
        toast.error(err?.message || 'Could not load addresses.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user, reloadKey])

  const validateForm = (f) => {
    const e = {}
    if (!f.fullName.trim()) e.fullName = 'Full name is required.'
    if (!/^\d{10}$/.test(f.mobile.trim()))
      e.mobile = 'Enter a valid 10-digit mobile number.'
    if (!f.addressLine1.trim()) e.addressLine1 = 'Address line 1 is required.'
    if (!f.city.trim()) e.city = 'City is required.'
    if (!f.state.trim()) e.state = 'State is required.'
    if (!/^\d{6}$/.test(f.pincode.trim()))
      e.pincode = 'Enter a valid 6-digit pincode.'
    return e
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const openAdd = () => {
    setForm(initialForm)
    setEditingId(null)
    setFormMode(true)
  }

  const openEdit = (addr) => {
    setForm({ ...addr })
    setEditingId(addr.id)
    setFormMode(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await saveAddress(user.uid, editingId || null, form)
      toast.success(`Address ${editingId ? 'updated' : 'added'} successfully.`)
      setFormMode(false)
      setEditingId(null)
      // refresh
      const data = await fetchAddresses(user.uid)
      setAddresses(data)
    } catch (err) {
      toast.error(err?.message || 'Could not save address.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this address?')) return
    try {
      await deleteAddress(user.uid, id)
      toast.success('Address deleted.')
      const data = await fetchAddresses(user.uid)
      setAddresses(data)
    } catch (err) {
      toast.error(err?.message || 'Could not delete address.')
    }
  }

  // RequireAuth protects this page; keep a visible fallback instead of a blank screen.
  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-brown-light">Please sign in to view and manage your saved addresses.</p>
        <Link to="/login" className="btn-primary mt-5 inline-flex items-center justify-center">Sign in</Link>
      </div>
    )
  }
  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-brown-light">Loading addresses…</p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Address Book — Vatvruksha Spiritual Vastu Bhandar</title>
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <Link to="/account" className="hover:text-maroon">My Account</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">Address Book</span>
          </nav>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {formMode ? (
          <div className="bg-white rounded-2xl border border-cream-dark p-8 md:p-10 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <Link
                to="/account/addresses"
                onClick={() => setFormMode(false)}
                className="text-maroon font-medium hover:underline inline-flex items-center gap-1"
              >
                ← Address Book
              </Link>
              <h2 className="font-serif text-2xl text-brown">
                {editingId ? 'Edit Address' : 'Add Address'}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    Full Name
                  </label>
                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.fullName ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    Mobile Number
                  </label>
                  <input
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.mobile ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.mobile && (
                    <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Address Line 1
                </label>
                <input
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={handleChange}
                  className={`w-full rounded-xl border px-3 py-2.5 ${
                    errors.addressLine1 ? 'border-red-400' : 'border-cream-dark'
                  }`}
                  required
                />
                {errors.addressLine1 && (
                  <p className="mt-1 text-xs text-red-600">{errors.addressLine1}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Address Line 2 (optional)
                </label>
                <input
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={handleChange}
                  className="w-full rounded-xl border px-3 py-2.5 border-cream-dark"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Landmark (optional)
                </label>
                <input
                  name="landmark"
                  value={form.landmark}
                  onChange={handleChange}
                  className="w-full rounded-xl border px-3 py-2.5 border-cream-dark"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    City
                  </label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.city ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    State
                  </label>
                  <input
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.state ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.state && (
                    <p className="mt-1 text-xs text-red-600">{errors.state}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Pincode
                </label>
                <input
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  className={`w-full rounded-xl border px-3 py-2.5 ${
                    errors.pincode ? 'border-red-400' : 'border-cream-dark'
                  }`}
                  required
                />
                {errors.pincode && (
                  <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) =>
                    setForm({ ...form, isDefault: e.target.checked })
                  }
                  className="accent-maroon rounded"
                />
                <label className="text-sm text-brown">Set as default address</label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3 disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingId ? 'Update Address' : 'Save Address'}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">Address Book</p>
                <h1 className="font-serif text-3xl text-brown mt-2">Saved Addresses</h1>
              </div>
              <button
                onClick={openAdd}
                className="btn-primary inline-flex items-center gap-2"
              >
                <Plus size={16} /> Add Address
              </button>
            </div>

            {loadError ? (
              <div className="bg-white rounded-2xl border border-amber-200 p-8 text-center" role="alert">
                <h2 className="font-serif text-2xl text-brown mb-3">Could not load saved addresses</h2>
                <p className="text-sm text-brown-light mb-5">{loadError}</p>
                <button type="button" onClick={() => setReloadKey((key) => key + 1)} className="btn-primary inline-flex items-center justify-center">Try again</button>
              </div>
            ) : addresses.length === 0 ? (
              <div className="bg-white rounded-2xl border border-cream-dark p-10 text-center">
                <MapPin size={48} className="mx-auto text-brown-light mb-4" />
                <h2 className="font-serif text-2xl text-brown mb-3">No saved addresses</h2>
                <p className="text-brown-light mb-6">
                  Add a delivery address to speed up checkout.
                </p>
                <button
                  onClick={openAdd}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  <Plus size={16} /> Add Address
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="bg-white rounded-2xl border border-cream-dark p-5 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-brown">{addr.fullName}</p>
                        {addr.isDefault && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-brown-light">
                        {addr.mobile}
                      </p>
                      <p className="text-sm text-brown-light">
                        {addr.addressLine1}
                        {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
                        {addr.landmark ? ` (${addr.landmark})` : ''}
                      </p>
                      <p className="text-sm text-brown-light">
                        {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(addr)}
                        className="p-2 text-brown hover:text-maroon hover:bg-cream rounded-lg"
                        aria-label="Edit address"
                      >
                        <MapPin size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(addr.id)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        aria-label="Delete address"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
